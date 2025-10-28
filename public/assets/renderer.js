let contacts = []
let sessions = []
let isManagerReady = false
let socket = null

const countryCodes = {
    '62': { name: 'Indonesia', length: [10, 11, 12] },
}

const API_BASE = ''

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        })
        return await response.json()
    } catch (error) {
        console.error(`API call failed: ${endpoint}`, error)
        return { success: false, error: error.message }
    }
}

function initializeWebSocket() {
    socket = io()
    
    socket.on('connect', () => {
        console.log('WebSocket connected')
    })
    
    socket.on('sessions-updated', (sessionData) => {
        sessions = sessionData
        displaySessions(sessionData)
        updateSessionCheckboxes()
        updateSendSessionSelect()
    })
    
    socket.on('disconnect', () => {
        console.log('WebSocket disconnected')
    })
}

function initTabs() {
    const navButtons = document.querySelectorAll('.nav-item')
    const tabContents = document.querySelectorAll('.tab-content')
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab
            
            navButtons.forEach(btn => btn.classList.remove('active'))
            tabContents.forEach(content => content.classList.remove('active'))
            
            button.classList.add('active')
            document.getElementById(targetTab).classList.add('active')
            
            if (targetTab === 'blast') {
                updateSessionCheckboxes(true)
            } else if (targetTab === 'send') {
                updateSendSessionSelect()
            } else if (targetTab === 'sessions') {
                if (isManagerReady) {
                    loadSessions()
                } else {
                    checkManagerStatus()
                }
            }
        })
    })
}

function formatPhoneNumber(input) {
    let value = input.value.replace(/[^\d+]/g, '')
    
    if (value && !value.startsWith('+')) {
        value = '+' + value
    }
    
    if (value.length > 1) {
        let formatted = value.substring(0, 1)
        let remaining = value.substring(1)
        
        if (remaining.length > 0) {
            formatted += remaining.substring(0, 4)
            if (remaining.length > 4) {
                formatted += ' ' + remaining.substring(4, 8)
                if (remaining.length > 8) {
                    formatted += ' ' + remaining.substring(8, 12)
                    if (remaining.length > 12) {
                        formatted += ' ' + remaining.substring(12, 16)
                    }
                }
            }
        }
        input.value = formatted
    } else {
        input.value = value
    }
    
    validatePhoneNumber(input)
}

function handlePhonePaste(event) {
    setTimeout(() => {
        formatPhoneNumber(event.target)
    }, 10)
}

function validatePhoneNumber(input) {
    const value = input.value.replace(/[^\d+]/g, '')
    const errorElement = document.getElementById(input.id + 'Error')
    
    input.classList.remove('is-invalid', 'is-valid')
    
    if (!value) {
        return false
    }
    
    if (!value.startsWith('+')) {
        showFieldError(input, errorElement, 'Phone number must start with country code (+)')
        return false
    }
    
    const numberWithoutPlus = value.substring(1)
    
    if (numberWithoutPlus.length < 7) {
        showFieldError(input, errorElement, 'Phone number is too short')
        return false
    }
    
    let countryCode = ''
    let phoneNumber = ''
    let isValidCountryCode = false
    
    for (let i = 1; i <= 4; i++) {
        const potentialCode = numberWithoutPlus.substring(0, i)
        if (countryCodes[potentialCode]) {
            countryCode = potentialCode
            phoneNumber = numberWithoutPlus.substring(i)
            isValidCountryCode = true
            break
        }
    }
    
    if (!isValidCountryCode) {
        showFieldError(input, errorElement, 'Invalid country code')
        return false
    }
    
    const countryInfo = countryCodes[countryCode]
    const phoneLength = phoneNumber.length
    
    if (!countryInfo.length.includes(phoneLength)) {
        showFieldError(input, errorElement, 
            `Invalid phone number length for ${countryInfo.name}. Expected ${countryInfo.length.join(' or ')} digits after country code`)
        return false
    }
    
    if (!/^\d+$/.test(phoneNumber)) {
        showFieldError(input, errorElement, 'Phone number contains invalid characters')
        return false
    }
    
    showFieldSuccess(input, errorElement)
    return true
}

function validateSessionName(input) {
    const value = input.value.trim()
    const errorElement = document.getElementById('sessionNameError')
    
    input.classList.remove('is-invalid', 'is-valid')
    
    if (!value) {
        return false
    }
    
    if (value.length < 3) {
        showFieldError(input, errorElement, 'Session name must be at least 3 characters')
        return false
    }
    
    if (value.length > 50) {
        showFieldError(input, errorElement, 'Session name must be less than 50 characters')
        return false
    }
    
    if (!/^[a-zA-Z0-9\s_-]+$/.test(value)) {
        showFieldError(input, errorElement, 'Session name can only contain letters, numbers, spaces, hyphens and underscores')
        return false
    }
   
   showFieldSuccess(input, errorElement)
   return true
}

function showFieldError(input, errorElement, message) {
    input.classList.add('is-invalid')
    input.classList.remove('is-valid')
    if (errorElement) {
        errorElement.textContent = message
        errorElement.style.display = 'block'
    }
}

function showFieldSuccess(input, errorElement) {
    input.classList.remove('is-invalid')
    input.classList.add('is-valid')
    if (errorElement) {
        errorElement.style.display = 'none'
    }
}

async function checkManagerStatus() {
 try {
   const result = await apiCall('/api/manager/status')
   if (result.success) {
     isManagerReady = result.data.isInitialized && result.data.hasManager
     
     if (!isManagerReady) {
       document.getElementById('sessionsList').innerHTML = `
         <div class="text-center py-4">
           <div class="spinner-border text-primary mb-3" role="status">
             <span class="visually-hidden">Loading...</span>
           </div>
           <p class="text-muted">Initializing WhatsApp Manager...</p>
         </div>
       `
       setTimeout(checkManagerStatus, 2000)
     } else {
       console.log('Manager is ready, loading sessions...')
       loadSessions()
     }
   }
 } catch (error) {
   console.error('Error checking manager status:', error)
   setTimeout(checkManagerStatus, 2000)
 }
}

function togglePhoneNumber() {
   const connectionType = document.getElementById('connectionType').value
   const phoneNumberGroup = document.getElementById('phoneNumberGroup')
   
   if (connectionType === 'pairing') {
       phoneNumberGroup.classList.remove('d-none')
       setTimeout(() => {
           document.getElementById('phoneNumber').focus()
       }, 100)
   } else {
       phoneNumberGroup.classList.add('d-none')
       const phoneInput = document.getElementById('phoneNumber')
       phoneInput.classList.remove('is-invalid', 'is-valid')
       phoneInput.value = ''
   }
}

async function createSession() {
   if (!isManagerReady) {
       showAlert('warning', 'WhatsApp Manager is still initializing. Please wait a moment and try again.')
       return
   }
   
   const sessionNameInput = document.getElementById('sessionName')
   const connectionType = document.getElementById('connectionType').value
   const phoneNumberInput = document.getElementById('phoneNumber')
   
   if (!validateSessionName(sessionNameInput)) {
       sessionNameInput.focus()
       return
   }
   
   if (connectionType === 'pairing') {
       if (!phoneNumberInput.value.trim()) {
           showFieldError(phoneNumberInput, document.getElementById('phoneNumberError'), 'Phone number is required for pairing')
           phoneNumberInput.focus()
           return
       }
       
       if (!validatePhoneNumber(phoneNumberInput)) {
           phoneNumberInput.focus()
           return
       }
   }
   
   const sessionName = sessionNameInput.value.trim()
   const existingSession = sessions.find(s => s.sessionName.toLowerCase() === sessionName.toLowerCase())
   if (existingSession) {
       showFieldError(sessionNameInput, document.getElementById('sessionNameError'), 'A session with this name already exists')
       sessionNameInput.focus()
       return
   }
   
   try {
       console.log('Creating session...')
       const createButton = document.querySelector('button[onclick="createSession()"]')
       createButton.disabled = true
       createButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Creating...'
       
       const result = await apiCall('/api/sessions', {
           method: 'POST',
           body: JSON.stringify({
               userId: 1,
               type: connectionType,
               phoneNumber: phoneNumberInput.value.replace(/[^\d+]/g, ''),
               sessionName: sessionName
           })
       })
       
       if (result.success) {
           console.log('Session created successfully:', result.data)
           
           if (result.data.qrImage) {
               document.getElementById('qrImage').src = result.data.qrImage
               document.getElementById('qrCode').classList.remove('d-none')
               document.getElementById('pairingCode').classList.add('d-none')
               showAlert('success', 'QR Code generated! Scan with WhatsApp to connect.')
           } else if (result.data.pairingCode) {
               document.getElementById('pairingCodeText').textContent = result.data.pairingCode
               document.getElementById('pairingCode').classList.remove('d-none')
               document.getElementById('qrCode').classList.add('d-none')
               showAlert('success', `Pairing code: ${result.data.pairingCode}`)
           }
           
           sessionNameInput.value = ''
           phoneNumberInput.value = ''
           sessionNameInput.classList.remove('is-valid')
           phoneNumberInput.classList.remove('is-valid')
           
           startConnectionCheck(sessionName)
           
       } else {
           showAlert('danger', 'Error creating session: ' + result.error)
       }
   } catch (error) {
       showAlert('danger', 'Error: ' + error.message)
   } finally {
       const createButton = document.querySelector('button[onclick="createSession()"]')
       createButton.disabled = false
       createButton.innerHTML = '<i class="bi bi-play-circle me-2"></i>Create Session'
   }
}

function startConnectionCheck(sessionName) {
    const checkInterval = setInterval(async () => {
        try {
            const result = await apiCall('/api/sessions')
            if (result.success) {
                const targetSession = result.data.find(s => s.sessionName === sessionName)
                
                if (targetSession && targetSession.isConnected) {
                    document.getElementById('qrCode').classList.add('d-none')
                    document.getElementById('pairingCode').classList.add('d-none')
                    
                    showAlert('success', `Session "${sessionName}" connected successfully!`)
                    
                    sessions = result.data
                    displaySessions(sessions)
                    
                    clearInterval(checkInterval)
                }
            }
        } catch (error) {
            console.error('Error checking connection status:', error)
        }
    }, 2000)
    
    setTimeout(() => {
        clearInterval(checkInterval)
    }, 120000)
}

function hideConnectionPrompts() {
    document.getElementById('qrCode').classList.add('d-none')
    document.getElementById('pairingCode').classList.add('d-none')
}

async function loadSessions() {
  if (!isManagerReady) {
      return
  }
  
  try {
      const result = await apiCall('/api/sessions')
      
      if (result.success) {
          sessions = result.data
          displaySessions(sessions)
      } else {
          document.getElementById('sessionsList').innerHTML = `
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Error loading sessions: ${result.error}
            </div>
          `
      }
  } catch (error) {
      document.getElementById('sessionsList').innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error loading sessions. Retrying...
        </div>
      `
  }
}

function displaySessions(sessionList) {
  const sessionsList = document.getElementById('sessionsList')
  
  if (sessionList.length === 0) {
      sessionsList.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-chat-dots"></i>
          <h6 class="text-muted mb-2">No sessions found</h6>
          <p class="text-muted small mb-0">Create a new session to get started</p>
        </div>
      `
      return
  }
  
  sessionsList.innerHTML = sessionList.map(session => {
      const statusText = session.isConnected ? 'Connected' : session.status
      const statusClass = session.isConnected ? 'status-connected' : 
                         session.status === 'active' ? 'status-connected' :
                         session.status === 'pending' ? 'status-pending' : 'status-disconnected'
      const icon = session.isConnected ? 'bi-check-circle-fill' : 'bi-clock'
      
      return `
          <div class="session-item">
              <div class="d-flex align-items-center justify-content-between">
                  <div class="flex-grow-1">
                      <div class="d-flex align-items-center gap-3 mb-2">
                          <div class="contact-avatar">
                              <i class="${session.isConnected ? 'bi-whatsapp' : 'bi-clock'} text-white"></i>
                          </div>
                          <div>
                              <h6 class="mb-1">${session.sessionName}</h6>
                              <span class="status-badge ${statusClass}">
                                  <i class="${icon}"></i>${statusText}
                              </span>
                          </div>
                      </div>
                      <div class="session-meta">
                          <div>ID: ${session.sessionKey}</div>
                          <div>Created: ${new Date(session.createdAt).toLocaleString()}</div>
                          ${session.lastActive ? `<div>Last Active: ${new Date(session.lastActive).toLocaleString()}</div>` : ''}
                      </div>
                  </div>
                  <div class="session-actions">
                      <button class="btn btn-outline-danger btn-sm ${!session.isConnected ? 'disabled' : ''}" 
                              onclick="logoutSession('${session.sessionKey}')"
                              ${!session.isConnected ? 'disabled' : ''}>
                          <i class="bi bi-box-arrow-right"></i>
                      </button>
                  </div>
              </div>
          </div>
      `
  }).join('')
}

async function logoutSession(sessionKey) {
    if (!confirm('Are you sure you want to logout this session?')) {
        return
    }
    
    try {
        const result = await apiCall(`/api/sessions/${sessionKey}/logout`, {
            method: 'POST'
        })
        
        if (result.success) {
            showAlert('success', 'Session logged out successfully')
            setTimeout(loadSessions, 1000)
        } else {
            showAlert('danger', 'Error logging out: ' + result.error)
        }
    } catch (error) {
        showAlert('danger', 'Error: ' + error.message)
    }
}

async function importContacts() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'
    
    input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        
        const formData = new FormData()
        formData.append('file', file)
        
        try {
            const response = await fetch('/api/contacts/import', {
                method: 'POST',
                body: formData
            })
            
            const result = await response.json()
            
            if (result.success) {
                contacts = result.data
                displayContacts(contacts)
                showAlert('success', `Successfully imported ${contacts.length} contacts`)
            } else {
                showAlert('danger', 'Error importing contacts: ' + result.error)
            }
        } catch (error) {
            showAlert('danger', 'Error: ' + error.message)
        }
    }
    
    input.click()
}

function displayContacts(contactList) {
 const contactsList = document.getElementById('contactsList')
 
 if (contactList.length === 0) {
     contactsList.innerHTML = `
       <div class="empty-state">
         <i class="bi bi-people"></i>
         <h6 class="text-muted mb-2">No contacts imported</h6>
         <p class="text-muted small mb-0">Click "Import Excel" to load contacts</p>
       </div>
     `
     return
 }
 
 contactsList.innerHTML = `
   <div class="table-responsive">
     <table class="table table-dark table-hover">
       <thead>
         <tr>
           <th>#</th>
           <th>Name</th>
           <th>Phone</th>
         </tr>
       </thead>
       <tbody>
         ${contactList.map((contact, index) => {
           const name = contact.Name || contact.name || 'N/A'
           const phone = contact.Phone || contact.phone || contact.Number || contact.number || contact.phoneNumber || 'N/A'
           return `
             <tr>
               <td>${index + 1}</td>
               <td>${name}</td>
               <td>${phone}</td>
             </tr>
           `
         }).join('')}
       </tbody>
     </table>
     <div class="text-muted mt-2">
       <small>Total contacts: ${contactList.length}</small>
     </div>
   </div>
 `
}

function selectAllSessions() {
    const checkboxes = document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]')
    checkboxes.forEach(cb => cb.checked = true)
}

function deselectAllSessions() {
    const checkboxes = document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]')
    checkboxes.forEach(cb => cb.checked = false)
}

function selectRandomSession() {
    const checkboxes = document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]')
    deselectAllSessions()
    if (checkboxes.length > 0) {
        const randomIndex = Math.floor(Math.random() * checkboxes.length)
        checkboxes[randomIndex].checked = true
    }
}

function updateSessionCheckboxes(force = false) {
    const sessionCheckboxes = document.getElementById('sessionCheckboxes')
    
    if (!force && sessions.length === 0) return
    
    const existingCheckboxes = Array.from(document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]'))
    const existingValues = existingCheckboxes.map(cb => cb.value)
    
    const connectedSessions = sessions.filter(s => s.isConnected)
    
    if (connectedSessions.length === 0) {
        sessionCheckboxes.innerHTML = `
            <div class="text-muted text-center py-3">
                <small>No connected sessions available</small>
            </div>
        `
        return
    }
    
    sessionCheckboxes.innerHTML = connectedSessions.map(session => `
        <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" value="${session.sessionKey}" 
                   id="session-${session.sessionKey}">
            <label class="form-check-label" for="session-${session.sessionKey}">
                ${session.sessionName}
                <span class="badge bg-success ms-2">Connected</span>
            </label>
        </div>
    `).join('')
}

function updateSendSessionSelect() {
 const sendSessionSelect = document.getElementById('sendSessionSelect')
 
 const connectedSessions = sessions.filter(s => s.isConnected)
 
 sendSessionSelect.innerHTML = '<option value="">Choose a session...</option>' +
   connectedSessions.map(session => `
     <option value="${session.sessionKey}">${session.sessionName}</option>
   `).join('')
}

async function sendBlastMessage() {
    const message = document.getElementById('blastMessage').value.trim()
    
    if (!message) {
        document.getElementById('blastMessage').focus()
        return showAlert('warning', 'Please enter a message')
    }
    
    const selectedSessions = Array.from(document.querySelectorAll('#sessionCheckboxes input:checked'))
        .map(cb => cb.value)
    
    if (selectedSessions.length === 0) {
        return showAlert('warning', 'Please select at least one session')
    }
    
    if (contacts.length === 0) {
        return showAlert('warning', 'Please import contacts first')
    }
    
    const sessionNames = Array.from(document.querySelectorAll('#sessionCheckboxes input:checked'))
        .map(cb => cb.nextElementSibling.textContent.trim().replace(/Connected$/, '').trim())
    
    if (!confirm(`Send message to ${contacts.length} contacts using ${selectedSessions.length} session(s): ${sessionNames.join(', ')}?`)) {
        return
    }
    
    try {
        const blastButton = document.querySelector('button[onclick="sendBlastMessage()"]')
        blastButton.disabled = true
        blastButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...'
        
        document.getElementById('blastProgress').classList.remove('d-none')
        
        const result = await apiCall('/api/messages/blast', {
            method: 'POST',
            body: JSON.stringify({
                contacts: contacts,
                message: message,
                sessionIds: selectedSessions
            })
        })
        
        if (result.success) {
            showAlert('success', `Blast message sent successfully! Results: ${JSON.stringify(result.data)}`)
            document.getElementById('blastMessage').value = ''
        } else {
            showAlert('danger', 'Error sending blast: ' + result.error)
        }
    } catch (error) {
        showAlert('danger', 'Error: ' + error.message)
    } finally {
        const blastButton = document.querySelector('button[onclick="sendBlastMessage()"]')
        blastButton.disabled = false
        blastButton.innerHTML = '<i class="bi bi-send-fill me-2"></i>Send Blast Message'
        
        document.getElementById('blastProgress').classList.add('d-none')
    }
}

async function sendSingleMessage() {
 const sessionId = document.getElementById('sendSessionSelect').value
 const recipientInput = document.getElementById('recipient')
 const messageInput = document.getElementById('singleMessage')
 
 if (!sessionId) {
     document.getElementById('sendSessionSelect').focus()
     return showAlert('warning', 'Please select a session')
 }
 
 if (!recipientInput.value.trim()) {
     showFieldError(recipientInput, document.getElementById('recipientError'), 'Please enter recipient phone number')
     recipientInput.focus()
     return
 }
 
 if (!validatePhoneNumber(recipientInput)) {
     recipientInput.focus()
     return
 }
 
 const message = messageInput.value.trim()
 if (!message) {
     messageInput.focus()
     return showAlert('warning', 'Please enter a message')
 }
 
 try {
     const sendButton = document.querySelector('button[onclick="sendSingleMessage()"]')
     sendButton.disabled = true
     sendButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...'
     
     const result = await apiCall('/api/messages/send', {
         method: 'POST',
         body: JSON.stringify({
             sessionId: sessionId,
             recipient: recipientInput.value.replace(/[^\d+]/g, ''),
             message: message
         })
     })
     
     if (result.success) {
         showAlert('success', 'Message sent successfully!')
         recipientInput.value = ''
         messageInput.value = ''
         recipientInput.classList.remove('is-valid')
     } else {
         showAlert('danger', 'Error sending message: ' + result.error)
     }
 } catch (error) {
     showAlert('danger', 'Error: ' + error.message)
 } finally {
     const sendButton = document.querySelector('button[onclick="sendSingleMessage()"]')
     sendButton.disabled = false
     sendButton.innerHTML = '<i class="bi bi-send me-2"></i>Send Message'
 }
}

function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer')
    const alertId = 'alert-' + Date.now()
    
    const alertHTML = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML)
    
    setTimeout(() => {
        const alert = document.getElementById(alertId)
        if (alert) {
            alert.remove()
        }
    }, 5000)
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing WhatsApp Blast Manager Web UI...')
    
    initTabs()
    initializeWebSocket()
    checkManagerStatus()
    
    const sessionNameInput = document.getElementById('sessionName')
    if (sessionNameInput) {
        sessionNameInput.addEventListener('input', () => validateSessionName(sessionNameInput))
    }
    
    const phoneNumberInput = document.getElementById('phoneNumber')
    if (phoneNumberInput) {
        phoneNumberInput.addEventListener('input', () => formatPhoneNumber(phoneNumberInput))
        phoneNumberInput.addEventListener('paste', handlePhonePaste)
    }
    
    const recipientInput = document.getElementById('recipient')
    if (recipientInput) {
        recipientInput.addEventListener('input', () => formatPhoneNumber(recipientInput))
        recipientInput.addEventListener('paste', handlePhonePaste)
    }
    
    console.log('Web UI initialized')
})
