import * as XLSX from 'xlsx'

// Common column name mappings
const COLUMN_ALIASES = {
  employeeId: ['employeeid', 'employee_id', 'emp_id', 'empid', 'id', 'staffid', 'staff_id', 'number', 'empno', 'emp_no'],
  firstName: ['firstname', 'first_name', 'first', 'fname', 'givenname', 'given_name'],
  lastName: ['lastname', 'last_name', 'last', 'lname', 'surname', 'familyname', 'family_name'],
  department: ['department', 'dept', 'division', 'team', 'group', 'unit'],
  jobTitle: ['jobtitle', 'job_title', 'title', 'position', 'role', 'designation'],
  badgeNumber: ['badgenumber', 'badge_number', 'badge', 'badgeno', 'badge_no', 'cardnumber', 'card_number'],
  email: ['email', 'emailaddress', 'email_address', 'mail', 'e-mail'],
  phone: ['phone', 'phonenumber', 'phone_number', 'mobile', 'tel', 'telephone'],
}

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[\s\-_./]/g, '').trim()
}

export function autoMapColumns(headers) {
  const mapping = {}

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const header of headers) {
      const normalized = normalizeHeader(header)
      if (aliases.includes(normalized)) {
        mapping[field] = header
        break
      }
    }
  }

  return mapping
}

export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        const firstSheet = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheet]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        if (jsonData.length === 0) {
          reject(new Error('The file appears to be empty or has no data rows.'))
          return
        }

        const headers = Object.keys(jsonData[0])
        const columnMapping = autoMapColumns(headers)

        resolve({
          rawData: jsonData,
          headers,
          columnMapping,
          sheetName: firstSheet,
          rowCount: jsonData.length,
        })
      } catch (err) {
        reject(new Error(`Failed to parse file: ${err.message}`))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsArrayBuffer(file)
  })
}

export function transformData(rawData, columnMapping) {
  return rawData.map((row, index) => {
    const employee = {
      employeeId: String(
        row[columnMapping.employeeId] || `EMP-${String(index + 1).padStart(4, '0')}`
      ).trim(),
      firstName: String(row[columnMapping.firstName] || '').trim(),
      lastName: String(row[columnMapping.lastName] || '').trim(),
      department: String(row[columnMapping.department] || '').trim(),
      jobTitle: String(row[columnMapping.jobTitle] || '').trim(),
      badgeNumber: String(row[columnMapping.badgeNumber] || '').trim(),
      email: String(row[columnMapping.email] || '').trim(),
      phone: String(row[columnMapping.phone] || '').trim(),
    }

    // Build full name
    employee.fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ')

    return employee
  })
}

export function getFieldOptions() {
  return Object.keys(COLUMN_ALIASES)
}
