import { getAccessToken } from './auth';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SHAREPOINT_SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;

const LIST_NAMES = {
  employees: 'Employee Badges',
  printHistory: 'Badge Print History',
  clients: 'Language School Clients',
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

// SharePoint field name helpers
// When columns are created with spaces (e.g., "First Name"),
// SharePoint internal names use _x0020_ encoding (e.g., "First_x0020_Name")
// The Graph API fields object may return either format depending on the context
function getField(fields, ...names) {
  for (const name of names) {
    if (fields[name] !== undefined && fields[name] !== null) return fields[name];
  }
  return '';
}

function mapEmployeeFromSharePoint(item) {
  const f = item.fields;
  const firstName = f.FirstName || '';
  const lastName = f.LastName || '';
  const department = f.Department || '';
  const jobTitle = f.JobTitle || '';
  const badgeNumber = f.BadgeNumber || '';
  const email = f.Email || '';
  const phone = f.Phone || '';
  const photoUrl = f.PhotoURL || '';
  const printCount = f.PrintCount || 0;
  const lastPrinted = f.LastPrinted || null;

  return {
    id: item.id,
    employeeId: f.Title || '',
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    department,
    jobTitle,
    badgeNumber,
    email,
    phone,
    photoUrl,
    printCount: Number(printCount) || 0,
    lastPrinted,
    searchText: [f.Title, firstName, lastName, department, jobTitle, badgeNumber, email]
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

  // Try filter by Title field first
  try {
    const filter = encodeURIComponent(`fields/Title eq '${employeeId}'`);
    const data = await graphFetch(
      `/sites/${siteId}/lists/${listId}/items?$expand=fields&$filter=${filter}`
    );
    if (data.value && data.value.length > 0) {
      return mapEmployeeFromSharePoint(data.value[0]);
    }
  } catch (err) {
    console.warn('Filter search failed, trying full scan:', err.message);
  }

  // Fallback: fetch all and find by employeeId or SharePoint item id
  const allEmployees = await getAllEmployees();
  return allEmployees.find(
    (emp) => emp.employeeId === employeeId || emp.id === employeeId
  ) || null;
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
  let successCount = 0;
  let firstError = null;

  for (let i = 0; i < employees.length; i++) {
    try {
      const result = await createEmployee(employees[i]);
      results.push(result);
      successCount++;
    } catch (err) {
      console.error(`Failed to create employee ${i + 1} (${employees[i].firstName} ${employees[i].lastName}):`, err.message);
      if (!firstError) firstError = err.message;
      results.push({ error: err.message });
    }
    if (onProgress) onProgress(i + 1, employees.length);
    // Small delay every 10 items to avoid throttling
    if ((i + 1) % 10 === 0 && i + 1 < employees.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  if (successCount === 0 && firstError) {
    throw new Error(`All imports failed. First error: ${firstError}`);
  }

  if (successCount < employees.length) {
    console.warn(`Import completed with errors: ${successCount}/${employees.length} succeeded`);
  }

  return { results, successCount, failCount: employees.length - successCount };
}

export async function deleteEmployee(itemId) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.employees);
  return graphFetch(`/sites/${siteId}/lists/${listId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function deleteAllEmployees(onProgress) {
  const employees = await getAllEmployees();
  let deleted = 0;

  for (let i = 0; i < employees.length; i++) {
    try {
      await deleteEmployee(employees[i].id);
      deleted++;
    } catch (err) {
      console.error(`Failed to delete item ${employees[i].id}:`, err);
    }
    if (onProgress) onProgress(i + 1, employees.length);
    if ((i + 1) % 10 === 0 && i + 1 < employees.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return { deleted, total: employees.length };
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
  try {
    const siteId = await getSiteId();
    const listId = await getListId(LIST_NAMES.printHistory);
    // Fetch all and sort client-side (avoids needing indexed columns)
    const data = await graphFetch(
      `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=100`
    );

    if (!data.value) return [];
    const mapped = data.value.map((item) => ({
      id: item.id,
      employeeId: item.fields.Title,
      employeeName: getField(item.fields, 'EmployeeName', 'Employee_x0020_Name'),
      printDate: getField(item.fields, 'PrintDate', 'Print_x0020_Date'),
      printedBy: getField(item.fields, 'PrintedBy', 'Printed_x0020_By'),
    }));
    // Sort by date descending, return top N
    mapped.sort((a, b) => new Date(b.printDate || 0) - new Date(a.printDate || 0));
    return mapped.slice(0, limit);
  } catch (err) {
    console.error('getPrintHistory error:', err);
    return [];
  }
}

export async function getPrintCountToday() {
  try {
    const history = await getPrintHistory(100);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return history.filter((r) => new Date(r.printDate) >= today).length;
  } catch {
    return 0;
  }
}

// ─── Client CRUD ────────────────────────────────────────

function mapClientFromSharePoint(item) {
  const f = item.fields;
  const firstName = f.FirstName || '';
  const lastName = f.LastName || '';
  return {
    id: item.id,
    clientId: f.Title || '',
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    program: f.Program || '',
    email: f.Email || '',
    phone: f.Phone || '',
    startDate: f.StartDate || '',
    photoUrl: f.PhotoURL || '',
    searchText: [f.Title, firstName, lastName, f.Program, f.Email]
      .filter(Boolean).join(' ').toLowerCase(),
    _type: 'client',
  };
}

export async function getAllClients() {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.clients);

  let allItems = [];
  let nextLink = `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`;

  while (nextLink) {
    const url = nextLink.startsWith('http')
      ? nextLink.replace(GRAPH_BASE, '')
      : nextLink;
    const data = await graphFetch(url);
    if (data.value) allItems = allItems.concat(data.value);
    nextLink = data['@odata.nextLink'] || null;
  }

  return allItems.map(mapClientFromSharePoint);
}

export async function getClient(clientId) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.clients);

  try {
    const filter = encodeURIComponent(`fields/Title eq '${clientId}'`);
    const data = await graphFetch(
      `/sites/${siteId}/lists/${listId}/items?$expand=fields&$filter=${filter}`
    );
    if (data.value && data.value.length > 0) {
      return mapClientFromSharePoint(data.value[0]);
    }
  } catch (err) {
    console.warn('Client filter search failed, trying full scan:', err.message);
  }

  const allClients = await getAllClients();
  return allClients.find(
    (c) => c.clientId === clientId || c.id === clientId
  ) || null;
}

export async function createClient(clientData) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.clients);
  return graphFetch(`/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    body: {
      fields: {
        Title: clientData.clientId || '',
        FirstName: clientData.firstName || '',
        LastName: clientData.lastName || '',
        Program: clientData.program || '',
        Email: clientData.email || '',
        Phone: clientData.phone || '',
        StartDate: clientData.startDate || null,
      },
    },
  });
}

export async function updateClient(itemId, data) {
  const siteId = await getSiteId();
  const listId = await getListId(LIST_NAMES.clients);
  return graphFetch(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
    method: 'PATCH',
    body: data,
  });
}

export async function deleteAllClients(onProgress) {
  const clients = await getAllClients();
  let deleted = 0;

  for (let i = 0; i < clients.length; i++) {
    try {
      const siteId = await getSiteId();
      const listId = await getListId(LIST_NAMES.clients);
      await graphFetch(`/sites/${siteId}/lists/${listId}/items/${clients[i].id}`, {
        method: 'DELETE',
      });
      deleted++;
    } catch (err) {
      console.error(`Failed to delete client ${clients[i].id}:`, err);
    }
    if (onProgress) onProgress(i + 1, clients.length);
    if ((i + 1) % 10 === 0 && i + 1 < clients.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return { deleted, total: clients.length };
}

// ─── Photo Operations (Document Library) ────────────────

const photoBlobCache = new Map();

async function getDriveId(libraryName = 'Employee Photos') {
  const cacheKey = `magma_hr_drive_id_${libraryName}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  const siteId = await getSiteId();
  const data = await graphFetch(`/sites/${siteId}/drives`);
  const photoDrive = data.value.find(
    (d) => d.name === libraryName
  );

  if (!photoDrive) {
    throw new Error(`${libraryName} document library not found on the SharePoint site.`);
  }

  localStorage.setItem(cacheKey, photoDrive.id);
  return photoDrive.id;
}

export async function uploadPhoto(personId, blob, library = 'Employee Photos') {
  const token = await getAccessToken();
  const driveId = await getDriveId(library);
  const fileName = `${personId}.jpg`;

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

  const cacheKey = `${library}:${personId}`;
  if (photoBlobCache.has(cacheKey)) {
    URL.revokeObjectURL(photoBlobCache.get(cacheKey));
    photoBlobCache.delete(cacheKey);
  }

  const fileData = await response.json();

  // Update PhotoURL field on the record
  try {
    if (library === 'Client Photos') {
      const client = await getClient(personId);
      if (client) await updateClient(client.id, { PhotoURL: fileData.webUrl });
    } else {
      const emp = await getEmployee(personId);
      if (emp) await updateEmployee(emp.id, { PhotoURL: fileData.webUrl });
    }
  } catch (err) {
    console.warn('Could not update PhotoURL on record:', err);
  }

  return fileData;
}

export async function downloadPhoto(personId, library = 'Employee Photos') {
  const cacheKey = `${library}:${personId}`;
  if (photoBlobCache.has(cacheKey)) {
    return photoBlobCache.get(cacheKey);
  }

  try {
    const token = await getAccessToken();
    const driveId = await getDriveId(library);
    const fileName = `${personId}.jpg`;

    const response = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/root:/${fileName}:/content`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) return null;

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    photoBlobCache.set(cacheKey, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

export async function getAllPhotoNames(library = 'Employee Photos') {
  try {
    const driveId = await getDriveId(library);
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
  localStorage.removeItem('magma_hr_drive_id_Employee Photos');
  localStorage.removeItem('magma_hr_drive_id_Client Photos');
  Object.values(LIST_NAMES).forEach((name) => {
    localStorage.removeItem(`magma_hr_list_id_${name}`);
  });
}

// Debug: discover actual column internal names for a list
export async function getListColumns(listName) {
  const siteId = await getSiteId();
  const listId = await getListId(listName);
  const data = await graphFetch(
    `/sites/${siteId}/lists/${listId}/columns?$select=name,displayName`
  );
  if (data.value) {
    console.table(data.value.map((c) => ({
      displayName: c.displayName,
      internalName: c.name,
    })));
  }
  return data.value || [];
}
