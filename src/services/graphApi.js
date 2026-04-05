import { getAccessToken } from './auth';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SHAREPOINT_SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;

const LIST_NAMES = {
  employees: 'Employee Badges',
  printHistory: 'Badge Print History',
};

// ─── Helpers ─────────────────────────────────────────────

async function graphFetch(url, options = {}) {
  const token = await getAccessToken();
  const { method = 'GET', body, retries = 2 } = options;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(`${GRAPH_BASE}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt + 1) * 1000;
      console.warn(`Graph API throttled (429). Retrying in ${waitMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Graph API error ${response.status}: ${response.statusText} — ${errorBody}`
      );
    }

    if (response.status === 204) return null;
    return response.json();
  }

  throw new Error('Graph API request failed after maximum retries (429 throttling).');
}

// ─── Site & List ID caching ─────────────────────────────

export async function getSiteId() {
  const cached = localStorage.getItem('magma_hr_site_id');
  if (cached) return cached;

  const data = await graphFetch(`/sites/${SHAREPOINT_SITE_URL}`);
  const siteId = data.id;
  localStorage.setItem('magma_hr_site_id', siteId);
  return siteId;
}

async function getListId(listName) {
  const cacheKey = `magma_hr_list_id_${listName}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  const siteId = await getSiteId();
  const data = await graphFetch(`/sites/${siteId}/lists/${encodeURIComponent(listName)}`);
  const listId = data.id;
  localStorage.setItem(cacheKey, listId);
  return listId;
}

// ─── Employee data mapper ───────────────────────────────

function mapEmployeeFromSharePoint(item) {
  const f = item.fields;
  return {
    id: item.id, // SharePoint list item ID (for updates)
    employeeId: f.Title || '',
    firstName: f.FirstName || '',
    lastName: f.LastName || '',
    fullName: [f.FirstName, f.LastName].filter(Boolean).join(' '),
    department: f.Department || '',
    jobTitle: f.JobTitle || '',
    badgeNumber: f.BadgeNumber || '',
    email: f.Email || '',
    phone: f.Phone || '',
    photoUrl: f.PhotoUrl || '',
    printCount: f.PrintCount || 0,
    lastPrinted: f.LastPrinted || null,
    searchText: [f.Title, f.FirstName, f.LastName, f.Department, f.JobTitle, f.BadgeNumber, f.Email]
      .filter(Boolean).join(' ').toLowerCase(),
  };
}

// ─── Employee CRUD ──────────────────────────────────────

export async function getAllEmployees() {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.employees);

  let allItems = [];
  let nextLink = `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`;

  while (nextLink) {
    const url = nextLink.startsWith('http')
      ? nextLink.replace(GRAPH_BASE, '')
      : nextLink;
    const data = await graphFetch(url);
    if (data.value) {
      allItems = allItems.concat(data.value);
    }
    nextLink = data['@odata.nextLink'] || null;
  }

  return allItems.map(mapEmployeeFromSharePoint);
}

export async function getEmployee(employeeId) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.employees);
  const filter = encodeURIComponent(`fields/Title eq '${employeeId}'`);
  const data = await graphFetch(
    `/sites/${siteId}/lists/${listId}/items?$expand=fields&$filter=${filter}`
  );

  if (data.value && data.value.length > 0) {
    return mapEmployeeFromSharePoint(data.value[0]);
  }
  return null;
}

export async function createEmployee(employeeData) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.employees);
  return graphFetch(`/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    body: {
      fields: {
        Title: employeeData.employeeId || '',
        FirstName: employeeData.firstName || '',
        LastName: employeeData.lastName || '',
        Department: employeeData.department || '',
        JobTitle: employeeData.jobTitle || '',
        BadgeNumber: employeeData.badgeNumber || '',
        Email: employeeData.email || '',
        Phone: employeeData.phone || '',
        PrintCount: 0,
      },
    },
  });
}

export async function updateEmployee(itemId, data) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.employees);
  return graphFetch(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
    method: 'PATCH',
    body: data,
  });
}

export async function bulkCreateEmployees(employees, onProgress) {
  const results = [];
  for (let i = 0; i < employees.length; i++) {
    try {
      const result = await createEmployee(employees[i]);
      results.push(result);
    } catch (err) {
      console.error(`Failed to create employee ${i + 1}:`, err);
      results.push({ error: err.message });
    }
    if (onProgress) onProgress(i + 1, employees.length);
    // Small delay every 10 items to avoid throttling
    if ((i + 1) % 10 === 0 && i + 1 < employees.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return results;
}

// ─── Print History ──────────────────────────────────────

export async function addPrintRecord(employeeId, employeeName, printedBy) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.printHistory);
  return graphFetch(`/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    body: {
      fields: {
        Title: employeeId,
        EmployeeName: employeeName,
        PrintDate: new Date().toISOString(),
        PrintedBy: printedBy,
      },
    },
  });
}

export async function getPrintHistory(limit = 5) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.printHistory);
  const data = await graphFetch(
    `/sites/${siteId}/lists/${listId}/items?$expand=fields&$orderby=fields/PrintDate desc&$top=${limit}`
  );

  if (!data.value) return [];
  return data.value.map((item) => ({
    id: item.id,
    employeeId: item.fields.Title,
    employeeName: item.fields.EmployeeName || '',
    printDate: item.fields.PrintDate,
    printedBy: item.fields.PrintedBy || '',
  }));
}

export async function getPrintCountToday() {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.printHistory);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filter = encodeURIComponent(`fields/PrintDate ge '${today.toISOString()}'`);
  const data = await graphFetch(
    `/sites/${siteId}/lists/${listId}/items?$expand=fields&$filter=${filter}&$top=999`
  );
  return data.value ? data.value.length : 0;
}

// ─── Photo Operations (Document Library) ────────────────

const photoBlobCache = new Map();

async function getDriveId() {
  const cached = localStorage.getItem('magma_hr_drive_id');
  if (cached) return cached;

  const siteId = await getSiteId();
  const data = await graphFetch(`/sites/${siteId}/drives`);
  const photoDrive = data.value.find(
    (d) => d.name === 'Employee Photos'
  );

  if (!photoDrive) {
    throw new Error('Employee Photos document library not found on the SharePoint site.');
  }

  localStorage.setItem('magma_hr_drive_id', photoDrive.id);
  return photoDrive.id;
}

export async function uploadPhoto(employeeId, blob) {
  const token = await getAccessToken();
  const driveId = await getDriveId();
  const fileName = `${employeeId}.jpg`;

  const response = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/root:/${fileName}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
      },
      body: blob,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Photo upload failed: ${response.status} — ${errorBody}`);
  }

  // Invalidate cache for this employee
  if (photoBlobCache.has(employeeId)) {
    URL.revokeObjectURL(photoBlobCache.get(employeeId));
    photoBlobCache.delete(employeeId);
  }

  const fileData = await response.json();

  // Update employee's PhotoUrl field in the list
  try {
    const emp = await getEmployee(employeeId);
    if (emp) {
      await updateEmployee(emp.id, { PhotoUrl: fileData.webUrl });
    }
  } catch (err) {
    console.warn('Could not update PhotoUrl on employee record:', err);
  }

  return fileData;
}

export async function downloadPhoto(employeeId) {
  // Return cached blob URL if available
  if (photoBlobCache.has(employeeId)) {
    return photoBlobCache.get(employeeId);
  }

  try {
    const token = await getAccessToken();
    const driveId = await getDriveId();
    const fileName = `${employeeId}.jpg`;

    const response = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/root:/${fileName}:/content`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) return null;

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    photoBlobCache.set(employeeId, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

export async function getAllPhotoNames() {
  try {
    const driveId = await getDriveId();
    const data = await graphFetch(`/drives/${driveId}/root/children?$select=name&$top=999`);
    if (!data.value) return [];
    return data.value.map((f) => f.name);
  } catch {
    return [];
  }
}

// ─── Utility ────────────────────────────────────────────

export function clearGraphCache() {
  localStorage.removeItem('magma_hr_site_id');
  localStorage.removeItem('magma_hr_drive_id');
  Object.values(LIST_NAMES).forEach((name) => {
    localStorage.removeItem(`magma_hr_list_id_${name}`);
  });
}
