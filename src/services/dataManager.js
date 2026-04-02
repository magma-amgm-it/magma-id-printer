import { openDB } from 'idb'

const DB_NAME = 'MagmaBadgePrinter'
const DB_VERSION = 1

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('employees')) {
        const employeeStore = db.createObjectStore('employees', { keyPath: 'employeeId' })
        employeeStore.createIndex('lastName', 'lastName')
        employeeStore.createIndex('department', 'department')
        employeeStore.createIndex('search', 'searchText')
      }
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'employeeId' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('printHistory')) {
        const printStore = db.createObjectStore('printHistory', { keyPath: 'id', autoIncrement: true })
        printStore.createIndex('employeeId', 'employeeId')
        printStore.createIndex('printDate', 'printDate')
      }
    },
  })
}

// -- Employees --

export async function saveEmployees(employees) {
  const db = await getDB()
  const tx = db.transaction('employees', 'readwrite')
  const store = tx.objectStore('employees')

  // Clear existing data before import
  await store.clear()

  for (const emp of employees) {
    const searchText = [
      emp.employeeId,
      emp.firstName,
      emp.lastName,
      emp.department,
      emp.jobTitle,
      emp.badgeNumber,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    await store.put({ ...emp, searchText })
  }

  await tx.done

  // Save import metadata
  await saveSetting('lastImport', {
    count: employees.length,
    date: new Date().toISOString(),
  })

  return employees.length
}

export async function getAllEmployees() {
  const db = await getDB()
  return db.getAll('employees')
}

export async function getEmployee(employeeId) {
  const db = await getDB()
  return db.get('employees', employeeId)
}

export async function searchEmployees(query) {
  if (!query || !query.trim()) return getAllEmployees()

  const db = await getDB()
  const all = await db.getAll('employees')
  const terms = query.toLowerCase().split(/\s+/)

  return all.filter((emp) =>
    terms.every((term) => emp.searchText?.includes(term))
  )
}

export async function getEmployeeCount() {
  const db = await getDB()
  return db.count('employees')
}

// -- Photos --

export async function savePhoto(employeeId, photoBlob, source = 'webcam') {
  const db = await getDB()
  await db.put('photos', {
    employeeId,
    photoBlob,
    source,
    captureDate: new Date().toISOString(),
  })
}

export async function getPhoto(employeeId) {
  const db = await getDB()
  return db.get('photos', employeeId)
}

export async function getPhotoCount() {
  const db = await getDB()
  return db.count('photos')
}

export async function getAllPhotoIds() {
  const db = await getDB()
  return db.getAllKeys('photos')
}

export async function deletePhoto(employeeId) {
  const db = await getDB()
  await db.delete('photos', employeeId)
}

// -- Settings --

export async function saveSetting(key, value) {
  const db = await getDB()
  await db.put('settings', { key, value })
}

export async function getSetting(key) {
  const db = await getDB()
  const entry = await db.get('settings', key)
  return entry?.value
}

// -- Print History --

export async function addPrintRecord(employeeId, employeeName) {
  const db = await getDB()
  await db.add('printHistory', {
    employeeId,
    employeeName,
    printDate: new Date().toISOString(),
  })
}

export async function getPrintHistory(limit = 20) {
  const db = await getDB()
  const all = await db.getAll('printHistory')
  return all.sort((a, b) => b.printDate.localeCompare(a.printDate)).slice(0, limit)
}

export async function getPrintCountToday() {
  const db = await getDB()
  const all = await db.getAll('printHistory')
  const today = new Date().toISOString().split('T')[0]
  return all.filter((r) => r.printDate.startsWith(today)).length
}

// -- Utility --

export async function clearAllData() {
  const db = await getDB()
  const tx = db.transaction(['employees', 'photos', 'settings', 'printHistory'], 'readwrite')
  await tx.objectStore('employees').clear()
  await tx.objectStore('photos').clear()
  await tx.objectStore('settings').clear()
  await tx.objectStore('printHistory').clear()
  await tx.done
}
