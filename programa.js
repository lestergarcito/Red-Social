// Estado global
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let isGuestMode = false;
let selectedBase64Image = "";
let selectedExamBase64File = "";
let activeChatId = null;
let postToShare = null;
let currentExamToSolve = null;
let activeHashtagFilter = null;

let appSettings = JSON.parse(localStorage.getItem('appSettings')) || {
    darkMode: false,
    notifications: true,
    preferredCareers: ["Ingeniería en Sistemas"]
};

// Historial de Notificaciones Generales (Likes, Exámenes Resueltos y Comentarios)
let userNotifications = JSON.parse(localStorage.getItem('userNotifications')) || [];

// Lista de Exámenes creados
if (!localStorage.getItem('examsDB')) {
    localStorage.setItem('examsDB', JSON.stringify([
        {
            id: 101,
            author: 'carlos_v',
            title: 'Repaso de Estructura de Datos',
            subject: 'Ingeniería en Sistemas',
            attachedFile: null,
            questions: [
                '¿Cuál es la diferencia entre una Pila (Stack) y una Cola (Queue)?',
                '¿Qué complejidad de tiempo tiene el ordenamiento Quicksort en promedio?'
            ]
        }
    ]));
}

// Inicialización de IndexedDB (Versión 2 con almacén para Publicaciones y Repasos)
let db;
const dbRequest = indexedDB.open("MiUMGapp_DB", 3);

dbRequest.onupgradeneeded = function(e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains('messagesStore')) {
        const store = db.createObjectStore('messagesStore', { keyPath: 'id', autoIncrement: true });
        store.createIndex('chatId', 'chatId', { unique: false });
    }
    if (!db.objectStoreNames.contains('postsStore')) {
        const postsStore = db.createObjectStore('postsStore', { keyPath: 'id' });
        postsStore.createIndex('author', 'author', { unique: false });
    }
    if (!db.objectStoreNames.contains('examsStore')) {
        const examsStore = db.createObjectStore('examsStore', { keyPath: 'id' });
        examsStore.createIndex('author', 'author', { unique: false });
    }
    if (!db.objectStoreNames.contains('eventsStore')) {
        const store = db.createObjectStore('eventsStore', { keyPath: 'id' });
        store.createIndex('author', 'author', { unique: false });
    }
    if (!db.objectStoreNames.contains('marketStore')) {
        const store = db.createObjectStore('marketStore', { keyPath: 'id' });
        store.createIndex('author', 'author', { unique: false });
    }
    if (!db.objectStoreNames.contains('studyGroupsStore')) {
        const store = db.createObjectStore('studyGroupsStore', { keyPath: 'id' });
        store.createIndex('author', 'author', { unique: false });
    }
    if (!db.objectStoreNames.contains('notificationsStore')) {
        const store = db.createObjectStore('notificationsStore', { keyPath: 'id' });
        store.createIndex('targetUser', 'targetUser', { unique: false });
    }
    if (!db.objectStoreNames.contains('savedPostsStore')) {
        db.createObjectStore('savedPostsStore', { keyPath: 'username' });
    }
};

dbRequest.onsuccess = function(e) {
    db = e.target.result;
    db.onversionchange = function() { db.close(); };
    syncIndexedDBData();
};
dbRequest.onerror = function(e) {
    console.error('No se pudo abrir IndexedDB:', e.target.error);
};

// Datos Base iniciales
if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify([
        { fullName: 'Administrador Principal', username: 'admin', password: '2026', role: 'admin', isPrivate: false },
        { fullName: 'Carlos Mendoza', username: 'carlos_v', password: '123', age: '24', role: 'user', isPrivate: false },
        { fullName: 'Lester', username: 'Lestergar', password: '123', age: '18', role: 'user', isPrivate: false },
        { fullName: 'Pablo', username: 'pablom', password: '123', age: '20', role: 'user', isPrivate: false }
    ]));
}

if (!localStorage.getItem('posts')) {
    const timeLester = Date.now() - (15 * 60 * 1000);
    const timeCarlos = Date.now() - (3 * 3600 * 1000);
    localStorage.setItem('posts', JSON.stringify([
        {
            id: 1,
            author: 'carlos_v',
            career: 'Ingeniería en Sistemas',
            imageUrl: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=800&auto=format&fit=crop&q=80',
            caption: '¡Un atardecer increíble explorando nuevos lugares en MiUMGapp! 🌄✨ #UMG #Atardecer #Guatemala',
            likes: 52,
            timestamp: timeCarlos,
            comments: [
                { author: 'admin', text: '¡Excelente foto Carlos!' },
                { author: 'Lestergar', text: 'perfecto' }
            ]
        },
        {
            id: 2,
            author: 'Lestergar',
            career: 'Ingeniería en Sistemas',
            imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
            caption: 'que lindo es poder estar en esta universidad tan prestigiosa, 4to semestre siendo ingeniero! #Ingenieria #UMG',
            likes: 12,
            timestamp: timeLester,
            comments: [
                { author: 'pablom', text: 'muy bien lester' }
            ]
        }
    ]));
}

if (!localStorage.getItem('chatsDB')) {
    localStorage.setItem('chatsDB', JSON.stringify([
        {
            id: 'chat_carlos_v_Lestergar',
            type: 'direct',
            participants: ['carlos_v', 'Lestergar'],
            name: 'Lester',
            unreadBy: [],
            messages: [
                { sender: 'Lestergar', text: 'Hola Carlos, ¿cómo vas con los proyectos de UMG?', timestamp: Date.now() - 300000 }
            ]
        }
    ]));
}

let visits = parseInt(localStorage.getItem('visitCount') || '0') + 1;
localStorage.setItem('visitCount', visits.toString());

document.addEventListener('DOMContentLoaded', () => {
    applyAppSettings();
    renderFeed();

    if (!currentUser) {
        showWelcomeModal();
    } else {
        updateUI();
    }

    setInterval(() => {
        renderFeedTimestamps();
    }, 60000);
});

// GESTIÓN DE MODALES & CERRAR AL CLIQUEAR AFUERA
function openModalById(id) {
    closeAllModals();
    document.body.classList.add('modal-open');
    document.getElementById(id).classList.add('active');
}

function closeAllModals() {
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function closeModalOnBackdrop(event, modalId) {
    // Las ventanas de Bienvenida, Iniciar Sesión y Crear Cuenta no se cierran al hacer clic afuera
    if (modalId === 'welcome-modal' || modalId === 'login-modal' || modalId === 'register-modal') return;

    if (event.target.id === modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

// MÓDULO EXÁMENES Y REPASOS
function openExamsModal() {
    renderExamsList();
    openModalById('exams-modal');
}

function closeExamsModal() {
    document.getElementById('exams-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function switchExamTab(tabName) {
    const btnAvailable = document.getElementById('tab-btn-available-exams');
    const btnCreate = document.getElementById('tab-btn-create-exam');
    const contentAvailable = document.getElementById('tab-content-available');
    const contentCreate = document.getElementById('tab-content-create');

    if (tabName === 'available') {
        btnAvailable.classList.add('active');
        btnCreate.classList.remove('active');
        contentAvailable.style.display = 'block';
        contentCreate.style.display = 'none';
        renderExamsList();
    } else {
        btnCreate.classList.add('active');
        btnAvailable.classList.remove('active');
        contentCreate.style.display = 'block';
        contentAvailable.style.display = 'none';
    }
}

function handleExamFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('exam-file-chosen-name').innerText = file.name;
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedExamBase64File = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function renderExamsList() {
    const exams = JSON.parse(localStorage.getItem('examsDB')) || [];
    const container = document.getElementById('exams-list-container');
    container.innerHTML = '';

    if (exams.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:0.85em; text-align:center; padding:20px;">No hay exámenes publicados. ¡Sé el primero en crear uno!</p>';
        return;
    }

    exams.forEach(exam => {
        const canDelete = currentUser && (currentUser.username === exam.author || currentUser.role === 'admin');

        const div = document.createElement('div');
        div.className = 'exam-card';
        div.innerHTML = `
            <div class="exam-info">
                <h4>${exam.title} ${exam.attachedFile ? '📎' : ''}</h4>
                <p><b>Materia:</b> ${exam.subject} | <b>Creado por:</b> @${exam.author}</p>
            </div>
            <div class="exam-actions-group">
                <button class="btn btn-sm btn-gradient" onclick="openSolveExamModal(${exam.id})">
                    <i class="fa-solid fa-pen"></i> Iniciar Prueba
                </button>
                ${canDelete ? `<button class="btn btn-sm btn-danger-glass" title="Borrar Prueba" onclick="deleteExam(${exam.id})"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

function deleteExam(examId) {
    if (!currentUser) return;
    const exams = JSON.parse(localStorage.getItem('examsDB')) || [];
    const examIndex = exams.findIndex(e => e.id === examId);

    if (examIndex !== -1) {
        const exam = exams[examIndex];
        if (exam.author === currentUser.username || currentUser.role === 'admin') {
            if (confirm(`¿Estás seguro de que deseas borrar la prueba "${exam.title}"?`)) {
                exams.splice(examIndex, 1);
                localStorage.setItem('examsDB', JSON.stringify(exams));
                renderExamsList();
                showToast('Prueba Eliminada', 'El examen ha sido borrado exitosamente.');
            }
        } else {
            showToast('Acción Denegada', 'Solo el creador o el admin pueden borrar esta prueba.', 'warning');
        }
    }
}

function createNewExam(e) {
    e.preventDefault();
    if (!currentUser) { showWelcomeModal(); return; }

    const title = document.getElementById('exam-title').value.trim();
    const subject = document.getElementById('exam-subject').value.trim();
    const q1 = document.getElementById('exam-q1').value.trim();
    const q2 = document.getElementById('exam-q2').value.trim();
    const q3 = document.getElementById('exam-q3').value.trim();

    const questions = [q1, q2];
    if (q3) questions.push(q3);

    const exams = JSON.parse(localStorage.getItem('examsDB')) || [];
    const newExam = {
        id: Date.now(),
        author: currentUser.username,
        title: title,
        subject: subject,
        attachedFile: selectedExamBase64File || null,
        questions: questions
    };

    exams.push(newExam);
    localStorage.setItem('examsDB', JSON.stringify(exams));

    saveExamToIndexedDB(newExam);

    document.getElementById('create-exam-form').reset();
    document.getElementById('exam-file-chosen-name').innerText = "Ningún archivo adjuntado";
    selectedExamBase64File = "";

    switchExamTab('available');
    showToast('¡Examen Creado!', `Se publicó la prueba "${title}".`);
}

function openSolveExamModal(examId) {
    if (!currentUser) { showWelcomeModal(); return; }
    const exams = JSON.parse(localStorage.getItem('examsDB')) || [];
    currentExamToSolve = exams.find(e => e.id === examId);

    if (!currentExamToSolve) return;

    const body = document.getElementById('solve-exam-body');
    let questionsHTML = currentExamToSolve.questions.map((q, idx) => `
        <div class="input-group mt-10">
            <label style="font-size:0.85em; font-weight:700; margin-bottom:4px; display:block;">Pregunta ${idx + 1}: ${q}</label>
            <textarea id="ans-q-${idx}" placeholder="Escribe tu respuesta aquí..." required style="padding-left:14px;"></textarea>
        </div>
    `).join('');

    let attachmentHTML = '';
    if (currentExamToSolve.attachedFile) {
        attachmentHTML = `
            <div style="background:var(--input-bg); border:1px solid var(--card-border); padding:10px; border-radius:10px; margin-bottom:12px; text-align:center;">
                <span style="font-size:0.85em; font-weight:700;">📎 Hoja de ejercicios / Material Adjunto</span><br>
                <a href="${currentExamToSolve.attachedFile}" target="_blank" class="btn btn-sm btn-secondary-glass mt-5" style="display:inline-flex;">
                    <i class="fa-solid fa-eye"></i> Ver Hoja Adjunta
                </a>
            </div>
        `;
    }

    body.innerHTML = `
        <div class="modal-header">
            <h2><i class="fa-solid fa-pen-to-square"></i> Resolviendo: ${currentExamToSolve.title}</h2>
            <p>Materia: ${currentExamToSolve.subject} (Autor: @${currentExamToSolve.author})</p>
        </div>
        ${attachmentHTML}
        <form onsubmit="submitExamAnswers(event)">
            ${questionsHTML}
            <button type="submit" class="btn btn-gradient btn-block mt-15">
                <i class="fa-solid fa-check"></i> Enviar Respuestas
            </button>
        </form>
    `;

    closeExamsModal();
    openModalById('solve-exam-modal');
}

function closeSolveExamModal() {
    document.getElementById('solve-exam-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function submitExamAnswers(e) {
    e.preventDefault();
    if (!currentUser || !currentExamToSolve) return;

    const userAnswers = [];
    currentExamToSolve.questions.forEach((q, idx) => {
        const val = document.getElementById(`ans-q-${idx}`).value.trim();
        userAnswers.push({ question: q, answer: val });
    });

    userNotifications.push({
        id: Date.now(),
        type: 'exam_solved',
        targetUser: currentExamToSolve.author,
        fromUser: currentUser.username,
        examTitle: currentExamToSolve.title,
        answers: userAnswers,
        read: false,
        timestamp: Date.now()
    });

    localStorage.setItem('userNotifications', JSON.stringify(userNotifications));
    persistCampusCollection('userNotifications', userNotifications);

    closeSolveExamModal();
    showToast('Prueba Enviada', `Tus respuestas para "${currentExamToSolve.title}" fueron registradas.`);
}

function deleteNotification(notifId) {
    userNotifications = userNotifications.filter(n => n.id !== notifId);
    localStorage.setItem('userNotifications', JSON.stringify(userNotifications));
    persistCampusCollection('userNotifications', userNotifications);
    renderUserNotifications();
    showToast('Eliminado', 'Se borró la notificación.');
}

// HASHTAGS
function openHashtagsModal() {
    renderHashtagsCloud();
    renderTrendsFeed();
    openModalById('hashtags-modal');
}

function closeHashtagsModal() {
    document.getElementById('hashtags-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function filterPostsByHashtag(tag) {
    activeHashtagFilter = tag;
    closeHashtagsModal();

    document.getElementById('active-hashtag-name').innerText = tag;
    document.getElementById('hashtag-filter-bar').style.display = 'flex';

    renderFeed();
    showToast('Filtro Aplicado', `Mostrando publicaciones con ${tag}`);
}

function clearHashtagFilter() {
    activeHashtagFilter = null;
    document.getElementById('hashtag-filter-bar').style.display = 'none';
    renderFeed();
}

function switchHashtagTab(tabName) {
    const btnTags = document.getElementById('tab-btn-tags');
    const btnTrends = document.getElementById('tab-btn-trends');
    const contentTags = document.getElementById('tab-content-tags');
    const contentTrends = document.getElementById('tab-content-trends');

    if (tabName === 'tags') {
        btnTags.classList.add('active');
        btnTrends.classList.remove('active');
        contentTags.style.display = 'block';
        contentTrends.style.display = 'none';
    } else {
        btnTrends.classList.add('active');
        btnTags.classList.remove('active');
        contentTrends.style.display = 'block';
        contentTags.style.display = 'none';
    }
}

function renderHashtagsCloud() {
    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const cloudContainer = document.getElementById('hashtags-cloud');
    cloudContainer.innerHTML = '';

    const tagCounts = {};

    posts.forEach(post => {
        const matches = post.caption.match(/#[a-zA-Z0-9_áéíóúÁÉÍÓÚ]+/g);
        if (matches) {
            matches.forEach(tag => {
                const cleanTag = tag.trim();
                tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
            });
        }
    });

    const tagsArray = Object.keys(tagCounts);

    if (tagsArray.length === 0) {
        cloudContainer.innerHTML = '<p style="color:#94a3b8; font-size:0.85em;">No hay hashtags registrados en las publicaciones.</p>';
        return;
    }

    tagsArray.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'hashtag-chip';
        chip.onclick = () => filterPostsByHashtag(tag);
        chip.innerHTML = `${tag} <span style="font-size:0.75em; opacity:0.8;">(${tagCounts[tag]})</span>`;
        cloudContainer.appendChild(chip);
    });
}

function renderTrendsFeed() {
    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const trendsContainer = document.getElementById('trends-feed');
    trendsContainer.innerHTML = '';

    const trendingPosts = posts.filter(p => p.likes >= 50).sort((a, b) => b.likes - a.likes);

    if (trendingPosts.length === 0) {
        trendsContainer.innerHTML = '<p style="color:#94a3b8; font-size:0.85em; text-align:center; padding:20px;">Aún no hay publicaciones que superen los 50 likes. ¡Dale like a tus fotos favoritas!</p>';
        return;
    }

    trendingPosts.forEach(post => {
        const div = document.createElement('div');
        div.className = 'post-card mb-15';
        div.innerHTML = `
            <div class="post-header">
                <div class="post-user-wrapper">
                    <div class="post-avatar">${post.author.charAt(0).toUpperCase()}</div>
                    <div class="post-author-info">
                        <span class="post-author">@${post.author}</span>
                        <span class="post-time">${getTimeAgo(post.timestamp)}</span>
                    </div>
                </div>
                <span class="badge" style="background:#ec4899; color:white; font-size:0.75em; padding:4px 8px; border-radius:10px;"><i class="fa-solid fa-fire"></i> ${post.likes} Likes</span>
            </div>
            <img src="${post.imageUrl}" class="post-img" onclick="openLightboxModal('${post.imageUrl}')" alt="Foto Tendencia">
            <p class="post-caption">${post.caption}</p>
        `;
        trendsContainer.appendChild(div);
    });
}

// PERFIL PÚBLICO
function openUserPublicProfile(targetUsername) {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const targetUser = users.find(u => u.username === targetUsername);

    if (!targetUser) return;

    if (targetUser.isPrivate && (!currentUser || currentUser.username !== targetUsername)) {
        showToast('Cuenta Privada 🔒', `@${targetUsername} tiene una cuenta privada.`, 'warning');
        return;
    }

    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const exams = JSON.parse(localStorage.getItem('examsDB')) || [];
    
    const userPosts = posts.filter(p => p.author === targetUsername).reverse();
    const userExams = exams.filter(e => e.author === targetUsername);
    const contentContainer = document.getElementById('user-public-profile-content');

    let postsGridHTML = '';
    if (userPosts.length === 0) {
        postsGridHTML = '<p style="text-align:center; color:#94a3b8; padding:15px 0;">Este usuario aún no tiene publicaciones.</p>';
    } else {
        postsGridHTML = userPosts.map(p => `
            <div class="post-card mb-15">
                <div class="post-header">
                    <div class="post-user-wrapper">
                        <div class="post-avatar">${p.author.charAt(0).toUpperCase()}</div>
                        <div class="post-author-info">
                            <span class="post-author">@${p.author}</span>
                            <span class="post-time">${getTimeAgo(p.timestamp)}</span>
                        </div>
                    </div>
                </div>
                <img src="${p.imageUrl}" class="post-img" onclick="openLightboxModal('${p.imageUrl}')" alt="Foto">
                <p class="post-caption">${p.caption}</p>
            </div>
        `).join('');
    }

    let examsHTML = '';
    if (userExams.length === 0) {
        examsHTML = '<p style="font-size:0.8em; color:#94a3b8;">No ha publicado hojas de repaso aún.</p>';
    } else {
        examsHTML = userExams.map(e => `
            <div style="background:var(--input-bg); border:1px solid var(--card-border); padding:8px 12px; border-radius:8px; margin-bottom:6px; font-size:0.82em; display:flex; justify-content:space-between; align-items:center;">
                <span><b>${e.title}</b> (${e.subject})</span>
                <button class="btn btn-sm btn-gradient" onclick="closeUserPublicProfileModal(); openSolveExamModal(${e.id});">Resolver</button>
            </div>
        `).join('');
    }

    contentContainer.innerHTML = `
        <div class="profile-card-modal">
            <div class="profile-avatar-large">${targetUser.username.charAt(0).toUpperCase()}</div>
            <h2>${targetUser.fullName}</h2>
            <p style="color:#6366f1; font-weight:700; font-size:0.9em; margin-bottom:12px;">@${targetUser.username}</p>
            
            <div class="profile-details-grid mb-15">
                <div class="profile-detail-item">
                    <span>Rol de Cuenta</span>
                    <strong>${targetUser.role.toUpperCase()}</strong>
                </div>
                ${targetUser.role !== 'admin' ? `
                <div class="profile-detail-item">
                    <span>Edad</span>
                    <strong>${targetUser.age} años</strong>
                </div>` : ''}
                <div class="profile-detail-item">
                    <span>Publicaciones</span>
                    <strong>${userPosts.length}</strong>
                </div>
                <div class="profile-detail-item">
                    <span>Repasos Creados</span>
                    <strong>${userExams.length} exámenes</strong>
                </div>
            </div>

            <h4 style="text-align:left; font-size:0.9em; margin-bottom:8px;"><i class="fa-solid fa-pen-to-square"></i> Repasos Creados</h4>
            <div class="mb-15" style="max-height:120px; overflow-y:auto; text-align:left;">
                ${examsHTML}
            </div>

            <h4 style="text-align:left; font-size:0.9em; margin-bottom:8px;"><i class="fa-solid fa-images"></i> Publicaciones</h4>
            <div style="max-height: 220px; overflow-y: auto;">
                ${postsGridHTML}
            </div>
        </div>
    `;

    closeSearchModal();
    openModalById('user-public-profile-modal');
}

function closeUserPublicProfileModal() {
    document.getElementById('user-public-profile-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function deletePost(postId) {
    if (!currentUser) return;
    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex !== -1) {
        const post = posts[postIndex];
        if (post.author === currentUser.username || currentUser.role === 'admin') {
            if (confirm("¿Estás seguro de que deseas eliminar esta publicación?")) {
                posts.splice(postIndex, 1);
                localStorage.setItem('posts', JSON.stringify(posts));
                renderFeed();
                if (currentUser.role === 'admin') updateAdminStats();
                showToast('Publicación Eliminada', 'Se ha eliminado la publicación correctamente.');
            }
        } else {
            showToast('Acción Denegada', 'Solo puedes eliminar tus propias publicaciones.', 'warning');
        }
    }
}

function openShareModal(postId) {
    if (!currentUser) { showWelcomeModal(); return; }
    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    postToShare = posts.find(p => p.id === postId);
    if (!postToShare) return;

    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    const myChats = chatsDB.filter(c => c.participants.includes(currentUser.username));
    const container = document.getElementById('share-chat-list');
    container.innerHTML = '';

    if (myChats.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:0.85em; text-align:center;">No tienes chats abiertos. Inicia una conversación en Mensajes para compartir.</p>';
    } else {
        myChats.forEach(chat => {
            let name = chat.name;
            if (chat.type === 'direct') {
                const other = chat.participants.find(p => p !== currentUser.username);
                name = `@${other}`;
            }

            const div = document.createElement('div');
            div.className = 'share-item';
            div.innerHTML = `
                <span><strong>${name}</strong></span>
                <button class="btn btn-sm btn-gradient" onclick="sendSharedPost('${chat.id}')">
                    <i class="fa-solid fa-paper-plane"></i> Enviar
                </button>
            `;
            container.appendChild(div);
        });
    }

    openModalById('share-modal');
}

function closeShareModal() {
    document.getElementById('share-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function sendSharedPost(chatId) {
    if (!postToShare || !currentUser) return;

    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    const chat = chatsDB.find(c => c.id === chatId);

    if (chat) {
        const timestamp = Date.now();
        const sharedData = {
            sharedPost: {
                id: postToShare.id,
                author: postToShare.author,
                imageUrl: postToShare.imageUrl,
                caption: postToShare.caption
            }
        };

        const textMsg = `📷 Publicación compartida de @${postToShare.author}`;

        chat.messages.push({
            sender: currentUser.username,
            text: textMsg,
            sharedPost: sharedData.sharedPost,
            timestamp: timestamp
        });

        chat.unreadBy = chat.participants.filter(p => p !== currentUser.username);
        localStorage.setItem('chatsDB', JSON.stringify(chatsDB));
        saveMessageToIndexedDB(chatId, currentUser.username, textMsg, timestamp);

        closeShareModal();
        showToast('Enviado', 'La publicación ha sido compartida en el chat.');
    }
}

function applyAppSettings() {
    if (appSettings.darkMode) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

function toggleDarkMode(isDark) {
    appSettings.darkMode = isDark;
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    applyAppSettings();
}

function saveCareerPreferences() {
    const checkboxes = document.querySelectorAll('.career-check:checked');
    const selectedCareers = Array.from(checkboxes).map(cb => cb.value);

    appSettings.preferredCareers = selectedCareers;
    localStorage.setItem('appSettings', JSON.stringify(appSettings));

    renderFeed();
    showToast('Preferencias Guardadas', 'Tus preferencias de carreras han sido actualizadas.');
}

function toggleNotificationSetting(isNotify) {
    appSettings.notifications = isNotify;
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    showToast('Ajustes Actualizados', `Notificaciones de publicaciones ${isNotify ? 'activadas' : 'desactivadas'}.`);
}

function togglePrivateAccountSetting(isPrivate) {
    if (!currentUser) return;
    const users = JSON.parse(localStorage.getItem('users'));
    const userObj = users.find(u => u.username === currentUser.username);
    if (userObj) {
        userObj.isPrivate = isPrivate;
        currentUser.isPrivate = isPrivate;
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast('Privacidad Actualizada', `Tu cuenta ahora es ${isPrivate ? 'Privada (nadie podrá enviarte mensajes)' : 'Pública'}.`);
    }
}

function openSettingsModal() {
    if (!currentUser) { showWelcomeModal(); return; }
    document.getElementById('setting-dark-mode').checked = appSettings.darkMode;
    document.getElementById('setting-notifications').checked = appSettings.notifications;
    document.getElementById('setting-private-account').checked = !!currentUser.isPrivate;
    document.getElementById('setting-username').value = currentUser.username;
    document.getElementById('setting-password').value = currentUser.password;

    const careerChecks = document.querySelectorAll('.career-check');
    careerChecks.forEach(cb => {
        cb.checked = (appSettings.preferredCareers || []).includes(cb.value);
    });

    openModalById('settings-modal');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function updateUserAccount(e) {
    e.preventDefault();
    if (!currentUser) return;

    const newUsername = document.getElementById('setting-username').value.trim();
    const newPassword = document.getElementById('setting-password').value.trim();
    const users = JSON.parse(localStorage.getItem('users')) || [];

    if (newUsername !== currentUser.username && users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
        showToast('Nombre No Disponible', 'El usuario ingresado ya está en uso.', 'warning');
        return;
    }

    const oldUsername = currentUser.username;
    const userObj = users.find(u => u.username === oldUsername);
    if (userObj) {
        userObj.username = newUsername;
        userObj.password = newPassword;
        currentUser.username = newUsername;
        currentUser.password = newPassword;

        const posts = JSON.parse(localStorage.getItem('posts')) || [];
        posts.forEach(p => {
            if (p.author === oldUsername) p.author = newUsername;
            p.comments.forEach(c => { if (c.author === oldUsername) c.author = newUsername; });
        });

        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('posts', JSON.stringify(posts));

        closeSettingsModal();
        updateUI();
        renderFeed();
        showToast('Cuenta Actualizada', 'Tus credenciales han sido cambiadas exitosamente.');
    }
}

function openLightboxModal(imageSrc) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    img.src = imageSrc;
    modal.classList.add('active');
}

function closeLightboxModal() {
    document.getElementById('lightbox-modal').classList.remove('active');
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Reciente';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Hace unos segundos';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

function renderFeedTimestamps() {
    const timeElements = document.querySelectorAll('.post-time[data-timestamp]');
    timeElements.forEach(el => {
        const ts = parseInt(el.getAttribute('data-timestamp'));
        el.innerText = getTimeAgo(ts);
    });
}

// OPERACIONES INDEXEDDB
function saveMessageToIndexedDB(chatId, sender, text, timestamp) {
    if (!db) return;
    const tx = db.transaction(['messagesStore'], 'readwrite');
    const store = tx.objectStore('messagesStore');
    store.add({ chatId, sender, text, timestamp });
}

function savePostToIndexedDB(postObj) {
    if (!db) return;
    const tx = db.transaction(['postsStore'], 'readwrite');
    const store = tx.objectStore('postsStore');
    store.put(postObj);
}

function saveExamToIndexedDB(examObj) {
    if (!db) return;
    const tx = db.transaction(['examsStore'], 'readwrite');
    const store = tx.objectStore('examsStore');
    store.put(examObj);
}

function syncIndexedDBData() {
    if (!db) return;
    const tx = db.transaction(
        ['messagesStore', 'postsStore', 'examsStore', 'eventsStore',
         'marketStore', 'studyGroupsStore', 'notificationsStore', 'savedPostsStore'],
        'readwrite'
    );

    // Reconstruye mensajes desde el respaldo local para evitar duplicados.
    const messagesStore = tx.objectStore('messagesStore');
    messagesStore.clear();
    const chats = JSON.parse(localStorage.getItem('chatsDB') || '[]');
    chats.forEach(chat => (chat.messages || []).forEach(msg => {
        messagesStore.add({ chatId: chat.id, sender: msg.sender, text: msg.text, timestamp: msg.timestamp });
    }));

    const collections = [
        ['postsStore', 'posts'],
        ['examsStore', 'examsDB'],
        ['eventsStore', 'campusEvents'],
        ['marketStore', 'campusMarket'],
        ['studyGroupsStore', 'campusStudyGroups'],
        ['notificationsStore', 'userNotifications']
    ];
    collections.forEach(([storeName, localKey]) => {
        let items = [];
        try { items = JSON.parse(localStorage.getItem(localKey) || '[]') || []; } catch (_) {}
        const store = tx.objectStore(storeName);
        items.forEach(item => store.put(item));
    });

    const savedByUser = JSON.parse(localStorage.getItem('campusSavedPosts') || '{}');
    Object.entries(savedByUser).forEach(([username, postIds]) => {
        tx.objectStore('savedPostsStore').put({ username, postIds: Array.isArray(postIds) ? postIds : [] });
    });

    tx.oncomplete = refreshCampusCachesFromIndexedDB;
    tx.onerror = () => console.error('Error sincronizando IndexedDB:', tx.error);
}

function refreshCampusCachesFromIndexedDB() {
    if (!db) return;
    [
        ['eventsStore', 'campusEvents'],
        ['marketStore', 'campusMarket'],
        ['studyGroupsStore', 'campusStudyGroups'],
        ['notificationsStore', 'userNotifications']
    ].forEach(([storeName, localKey]) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => {
            localStorage.setItem(localKey, JSON.stringify(req.result || []));
            if (localKey === 'userNotifications') {
                userNotifications = req.result || [];
                if (currentUser && document.getElementById('notifications-list-body')) renderUserNotifications();
            }
        };
    });
    const savedReq = db.transaction('savedPostsStore', 'readonly').objectStore('savedPostsStore').getAll();
    savedReq.onsuccess = () => {
        const saved = {};
        (savedReq.result || []).forEach(item => { saved[item.username] = item.postIds || []; });
        localStorage.setItem('campusSavedPosts', JSON.stringify(saved));
    };
}

function persistCampusCollection(key, records) {
    if (!db) return;
    const stores = {
        campusEvents: 'eventsStore',
        campusMarket: 'marketStore',
        campusStudyGroups: 'studyGroupsStore',
        userNotifications: 'notificationsStore'
    };
    const storeName = stores[key];
    if (!storeName) return;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    records.forEach(record => store.put(record));
    tx.onerror = () => console.error(`Error guardando ${key}:`, tx.error);
}

function persistSavedPosts(username, postIds) {
    if (!db || !username) return;
    const tx = db.transaction('savedPostsStore', 'readwrite');
    tx.objectStore('savedPostsStore').put({ username, postIds });
    tx.onerror = () => console.error('Error guardando publicaciones favoritas:', tx.error);
}

// CAMPANA DE NOTIFICACIONES (LIKES, EXÁMENES Y COMENTARIOS)
function toggleNotificationsDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown.style.display === 'none' || !dropdown.style.display) {
        dropdown.style.display = 'block';
        renderUserNotifications();
    } else {
        dropdown.style.display = 'none';
    }
}

function renderUserNotifications() {
    const listBody = document.getElementById('notifications-list-body');
    const badge = document.getElementById('like-notifications-badge');

    if (!currentUser) return;

    const myNotifs = userNotifications.filter(n => n.targetUser === currentUser.username);

    if (myNotifs.length === 0) {
        listBody.innerHTML = '<p style="color:#94a3b8; font-size:0.75em; text-align:center; padding:10px;">No tienes notificaciones.</p>';
        badge.style.display = 'none';
        return;
    }

    const unreadCount = myNotifs.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }

    listBody.innerHTML = myNotifs.slice().reverse().map(n => {
        if (n.type === 'exam_solved') {
            const answersHTML = n.answers.map(a => `
                <div style="font-size:0.72em; margin-top:2px;"><b>P:</b> ${a.question}<br><b>R:</b> ${a.answer}</div>
            `).join('');

            return `
                <div class="notif-item">
                    <span><i class="fa-solid fa-graduation-cap" style="color:#6366f1;"></i> <strong>@${n.fromUser}</strong> resolvió tu prueba "<b>${n.examTitle}</b>":</span>
                    ${answersHTML}
                    <button class="notif-delete-btn" onclick="deleteNotification(${n.id})"><i class="fa-solid fa-trash-can"></i> Borrar Respuesta</button>
                </div>
            `;
        } else if (n.type === 'study_response') {
            return `
                <div class="notif-item">
                    <span><i class="fa-solid fa-people-group" style="color:#6366f1;"></i> <strong>@${escapeCampusText(n.fromUser)}</strong> ${n.response === 'accepted' ? 'aceptó' : 'rechazó'} tu invitación para el círculo <b>${escapeCampusText(n.circleTitle)}</b>.</span>
                    <div style="font-size:.75em;margin-top:6px;line-height:1.5;"><b>Estudiante:</b> ${escapeCampusText(n.studentName)} (@${escapeCampusText(n.fromUser)})<br><b>Materia:</b> ${escapeCampusText(n.subject)}<br><b>Horario:</b> ${escapeCampusText(n.schedule)}<br><b>Modalidad:</b> ${escapeCampusText(n.meetingPoint)}</div>
                    <button class="notif-delete-btn" onclick="deleteNotification(${n.id})"><i class="fa-solid fa-trash-can"></i> Borrar</button>
                </div>
            `;
        } else if (n.type === 'comment') {
            return `
                <div class="notif-item">
                    <span><i class="fa-solid fa-comment" style="color:#6366f1;"></i> <strong>@${n.fromUser}</strong> comentó en tu foto: "<i>${n.commentText}</i>"</span>
                    <button class="notif-delete-btn" onclick="deleteNotification(${n.id})"><i class="fa-solid fa-trash-can"></i> Borrar</button>
                </div>
            `;
        } else {
            return `
                <div class="notif-item">
                    <span><i class="fa-solid fa-heart" style="color:#ec4899;"></i> <strong>@${n.fromUser}</strong> le dio like a tu publicación.</span>
                    <button class="notif-delete-btn" onclick="deleteNotification(${n.id})"><i class="fa-solid fa-trash-can"></i> Borrar</button>
                </div>
            `;
        }
    }).join('');
}

function clearNotifications() {
    if (!currentUser) return;
    userNotifications = userNotifications.filter(n => n.targetUser !== currentUser.username);
    localStorage.setItem('userNotifications', JSON.stringify(userNotifications));
    persistCampusCollection('userNotifications', userNotifications);
    renderUserNotifications();
}

function openProfileModal() {
    if (!currentUser) {
        showWelcomeModal();
        return;
    }

    const body = document.getElementById('profile-modal-body');
    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const exams = JSON.parse(localStorage.getItem('examsDB')) || [];
    
    const userPostsCount = posts.filter(p => p.author === currentUser.username).length;
    const userExamsCount = exams.filter(e => e.author === currentUser.username).length;

    body.innerHTML = `
        <div class="profile-card-modal">
            <div class="profile-avatar-large">${currentUser.username.charAt(0).toUpperCase()}</div>
            <h2>${currentUser.fullName}</h2>
            <p style="color:#6366f1; font-weight:700; font-size:0.9em; margin-bottom:12px;">@${currentUser.username}</p>
            
            <div class="profile-details-grid">
                <div class="profile-detail-item">
                    <span>Rol de Cuenta</span>
                    <strong style="color:${currentUser.role === 'admin' ? '#a855f7' : '#1e293b'};">${currentUser.role.toUpperCase()}</strong>
                </div>
                ${currentUser.role !== 'admin' ? `
                <div class="profile-detail-item">
                    <span>Edad</span>
                    <strong>${currentUser.age} años</strong>
                </div>` : ''}
                <div class="profile-detail-item">
                    <span>Fotos Publicadas</span>
                    <strong>${userPostsCount} publicaciones</strong>
                </div>
                <div class="profile-detail-item">
                    <span>Exámenes Creados</span>
                    <strong>${userExamsCount} repasos</strong>
                </div>
                <div class="profile-detail-item">
                    <span>Privacidad</span>
                    <strong>${currentUser.isPrivate ? 'Cuenta Privada 🔒' : 'Pública 🌐'}</strong>
                </div>
            </div>

            <button onclick="logout()" class="btn btn-danger-glass btn-block mt-15">
                <i class="fa-solid fa-power-off"></i> Cerrar Sesión
            </button>
        </div>
    `;

    renderUserNotifications();
    openModalById('profile-modal');
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
    document.getElementById('notifications-dropdown').style.display = 'none';
}

// MENSAJES Y CHAT
function openMessagesModal() {
    if (!currentUser) { showWelcomeModal(); return; }
    hideCreateGroupView();
    renderSidebarChats();
    activeChatId = null;
    backToChatListMobile();
    document.getElementById('chat-placeholder').style.display = 'flex';
    document.getElementById('active-chat-container').style.display = 'none';
    checkUnreadGlobal();
    openModalById('messages-modal');
}

function closeMessagesModal() {
    document.getElementById('messages-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
    checkUnreadGlobal();
}

function backToChatListMobile() {
    const layout = document.querySelector('.chat-layout');
    if (layout) layout.classList.remove('mobile-chat-active');
}

function renderSidebarChats() {
    const chatsList = document.getElementById('chats-list');
    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    const users = JSON.parse(localStorage.getItem('users')) || [];
    chatsList.innerHTML = '';

    const myChats = chatsDB.filter(c => c.participants.includes(currentUser.username));

    myChats.forEach(chat => {
        const isUnread = chat.unreadBy && chat.unreadBy.includes(currentUser.username);
        let chatDisplayName = chat.name;
        if (chat.type === 'direct') {
            const otherUser = chat.participants.find(p => p !== currentUser.username);
            chatDisplayName = `@${otherUser}`;
        }

        const li = document.createElement('li');
        li.className = `chat-item ${activeChatId === chat.id ? 'active-chat' : ''}`;
        li.onclick = () => selectChat(chat.id);

        li.innerHTML = `
            <div class="chat-avatar">${chat.type === 'group' ? '<i class="fa-solid fa-users"></i>' : chatDisplayName.charAt(1).toUpperCase()}</div>
            <div class="chat-info">
                <span class="chat-name">${chatDisplayName}</span>
                ${isUnread ? '<span class="new-msg-tag"><i class="fa-solid fa-circle"></i> Mensaje nuevo</span>' : ''}
            </div>
        `;
        chatsList.appendChild(li);
    });

    const otherUsers = users.filter(u => u.username !== currentUser.username);
    otherUsers.forEach(u => {
        const chatExists = myChats.some(c => c.type === 'direct' && c.participants.includes(u.username));
        if (!chatExists) {
            const li = document.createElement('li');
            li.className = 'chat-item';
            li.onclick = () => startDirectChatWith(u.username);
            li.innerHTML = `
                <div class="chat-avatar">${u.username.charAt(0).toUpperCase()}</div>
                <div class="chat-info">
                    <span class="chat-name">@${u.username} ${u.isPrivate ? '🔒' : ''}</span>
                    <span style="font-size:0.7em; color:#94a3b8;">${u.isPrivate ? 'Cuenta Privada' : 'Iniciar chat'}</span>
                </div>
            `;
            chatsList.appendChild(li);
        }
    });
}

function startDirectChatWith(targetUsername) {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const targetUserObj = users.find(u => u.username === targetUsername);

    if (targetUserObj && targetUserObj.isPrivate) {
        showToast('Cuenta Privada', `@${targetUsername} tiene una cuenta privada y no puede recibir mensajes.`, 'warning');
        return;
    }

    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    let chat = chatsDB.find(c => c.type === 'direct' && c.participants.includes(currentUser.username) && c.participants.includes(targetUsername));

    if (!chat) {
        chat = {
            id: `chat_${currentUser.username}_${targetUsername}_${Date.now()}`,
            type: 'direct',
            participants: [currentUser.username, targetUsername],
            name: targetUsername,
            unreadBy: [],
            messages: []
        };
        chatsDB.push(chat);
        localStorage.setItem('chatsDB', JSON.stringify(chatsDB));
    }

    renderSidebarChats();
    selectChat(chat.id);
}

function selectChat(chatId) {
    activeChatId = chatId;
    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    const chat = chatsDB.find(c => c.id === chatId);

    if (!chat) return;

    if (chat.unreadBy && chat.unreadBy.includes(currentUser.username)) {
        chat.unreadBy = chat.unreadBy.filter(u => u !== currentUser.username);
        localStorage.setItem('chatsDB', JSON.stringify(chatsDB));
    }

    renderSidebarChats();
    checkUnreadGlobal();

    const layout = document.querySelector('.chat-layout');
    if (layout) layout.classList.add('mobile-chat-active');

    document.getElementById('chat-placeholder').style.display = 'none';
    const activeChatContainer = document.getElementById('active-chat-container');
    activeChatContainer.style.display = 'flex';

    let title = chat.name;
    if (chat.type === 'direct') {
        const other = chat.participants.find(p => p !== currentUser.username);
        title = `@${other}`;
    }
    document.getElementById('active-chat-title').innerText = title;

    renderChatMessages(chat);
}

function renderChatMessages(chat) {
    const body = document.getElementById('chat-messages-body');
    body.innerHTML = '';

    chat.messages.forEach(msg => {
        const isMe = msg.sender === currentUser.username;
        const bubble = document.createElement('div');
        bubble.className = `msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;

        let sharedCardHTML = '';
        if (msg.sharedPost) {
            sharedCardHTML = `
                <div class="shared-post-card" onclick="openLightboxModal('${msg.sharedPost.imageUrl}')">
                    <img src="${msg.sharedPost.imageUrl}" class="shared-post-thumb" alt="Foto">
                    <div class="shared-post-details">
                        <span class="shared-post-author">@${msg.sharedPost.author}</span>
                        <span class="shared-post-caption">${msg.sharedPost.caption}</span>
                    </div>
                </div>
            `;
        }

        bubble.innerHTML = `
            ${chat.type === 'group' && !isMe ? `<span class="msg-sender">@${msg.sender}</span>` : ''}
            <div>${msg.text}</div>
            ${sharedCardHTML}
        `;
        body.appendChild(bubble);
    });

    body.scrollTop = body.scrollHeight;
}

function sendMessage(e) {
    e.preventDefault();
    if (!activeChatId) return;

    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();
    if (!text) return;

    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    const chat = chatsDB.find(c => c.id === activeChatId);

    if (chat) {
        if (chat.type === 'direct') {
            const otherUser = chat.participants.find(p => p !== currentUser.username);
            const users = JSON.parse(localStorage.getItem('users')) || [];
            const targetObj = users.find(u => u.username === otherUser);
            if (targetObj && targetObj.isPrivate) {
                showToast('Mensaje No Enviado', `@${otherUser} cambió su cuenta a privada.`, 'warning');
                return;
            }
        }

        const timestamp = Date.now();
        const newMessage = { sender: currentUser.username, text: text, timestamp: timestamp };
        chat.messages.push(newMessage);

        chat.unreadBy = chat.participants.filter(p => p !== currentUser.username);

        localStorage.setItem('chatsDB', JSON.stringify(chatsDB));
        saveMessageToIndexedDB(activeChatId, currentUser.username, text, timestamp);

        input.value = '';
        renderChatMessages(chat);
        renderSidebarChats();
    }
}

function showCreateGroupView() {
    document.getElementById('chat-sidebar-view').style.display = 'none';
    document.getElementById('create-group-view').style.display = 'flex';

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const container = document.getElementById('group-users-select');
    container.innerHTML = '';

    users.filter(u => u.username !== currentUser.username).forEach(u => {
        const div = document.createElement('div');
        div.className = 'group-user-option';
        div.innerHTML = `
            <input type="checkbox" value="${u.username}" class="group-checkbox">
            <span>@${u.username} (${u.fullName})</span>
        `;
        container.appendChild(div);
    });
}

function hideCreateGroupView() {
    document.getElementById('create-group-view').style.display = 'none';
    document.getElementById('chat-sidebar-view').style.display = 'flex';
}

function createNewGroup() {
    const groupName = document.getElementById('group-name-input').value.trim();
    const checkboxes = document.querySelectorAll('.group-checkbox:checked');
    const selectedUsers = Array.from(checkboxes).map(cb => cb.value);

    if (!groupName) {
        showToast('Nombre Requerido', 'Ingresa un nombre para el grupo.', 'warning');
        return;
    }

    if (selectedUsers.length === 0) {
        showToast('Integrantes Requeridos', 'Selecciona al menos un usuario.', 'warning');
        return;
    }

    selectedUsers.push(currentUser.username);

    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    const timestamp = Date.now();
    const newGroup = {
        id: `group_${timestamp}`,
        type: 'group',
        participants: selectedUsers,
        name: groupName,
        unreadBy: selectedUsers.filter(u => u !== currentUser.username),
        messages: [{ sender: 'Sistema', text: `Grupo "${groupName}" creado.`, timestamp: timestamp }]
    };

    chatsDB.push(newGroup);
    localStorage.setItem('chatsDB', JSON.stringify(chatsDB));
    saveMessageToIndexedDB(newGroup.id, 'Sistema', `Grupo "${groupName}" creado.`, timestamp);

    hideCreateGroupView();
    renderSidebarChats();
    selectChat(newGroup.id);
    showToast('¡Grupo Creado!', `Se creó el grupo "${groupName}".`);
}

function checkUnreadGlobal() {
    if (!currentUser) return;
    const chatsDB = JSON.parse(localStorage.getItem('chatsDB')) || [];
    const hasUnread = chatsDB.some(c => c.participants.includes(currentUser.username) && c.unreadBy && c.unreadBy.includes(currentUser.username));
    
    const badge = document.getElementById('unread-global-badge');
    if (badge) {
        badge.style.display = hasUnread ? 'block' : 'none';
    }
}

// ADMIN
function openAdminModal() {
    if (!currentUser || currentUser.role !== 'admin') return;
    updateAdminStats();
    renderIndexedDBAudit();
    openModalById('admin-modal');
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function renderIndexedDBAudit() {
    const container = document.getElementById('admin-chats-audit');
    container.innerHTML = '';

    if (!db) {
        container.innerHTML = '<p style="color:#94a3b8;">IndexedDB en proceso de carga...</p>';
        return;
    }

    const tx = db.transaction(['messagesStore'], 'readonly');
    const store = tx.objectStore('messagesStore');
    const getReq = store.getAll();

    getReq.onsuccess = function() {
        const records = getReq.result;
        if (records.length === 0) {
            container.innerHTML = '<p style="color:#94a3b8;">No hay registros de mensajes almacenados en IndexedDB.</p>';
            return;
        }

        records.forEach(rec => {
            const div = document.createElement('div');
            div.className = 'audit-chat-block';
            div.innerHTML = `
                <div><strong>Chat ID:</strong> ${rec.chatId}</div>
                <div><b>@${rec.sender}:</b> ${rec.text} <span style="font-size:0.7em; color:#94a3b8;">(${new Date(rec.timestamp).toLocaleTimeString()})</span></div>
            `;
            container.appendChild(div);
        });
    };
}

// CREAR PUBLICACIÓN
function openPublishModal() {
    if (!currentUser) { showWelcomeModal(); return; }
    selectedBase64Image = "";
    document.getElementById('post-file').value = "";
    document.getElementById('post-url').value = "";
    document.getElementById('post-caption').value = "";
    document.getElementById('file-chosen-name').innerText = "Ningún archivo seleccionado";
    document.getElementById('image-preview-container').style.display = "none";
    openModalById('publish-modal');
}

function closePublishModal() {
    document.getElementById('publish-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function previewSelectedFile(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('file-chosen-name').innerText = file.name;
        const reader = new FileReader();
        reader.onload = function (e) {
            selectedBase64Image = e.target.result;
            const previewContainer = document.getElementById('image-preview-container');
            const previewImg = document.getElementById('image-preview');
            previewImg.src = selectedBase64Image;
            previewContainer.style.display = "block";
            document.getElementById('post-url').value = "";
        };
        reader.readAsDataURL(file);
    }
}

function createPost(e) {
    e.preventDefault();
    if (!currentUser) return showWelcomeModal();

    const urlInput = document.getElementById('post-url').value.trim();
    const caption = document.getElementById('post-caption').value.trim();
    const career = document.getElementById('post-career-category').value;
    let finalImageUrl = selectedBase64Image || urlInput;

    if (!finalImageUrl) {
        showToast('Imagen requerida', 'Debes seleccionar un archivo o ingresar una URL de imagen.', 'warning');
        return;
    }

    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const newPost = {
        id: Date.now(),
        author: currentUser.username,
        career: career,
        imageUrl: finalImageUrl,
        caption: caption,
        likes: 0,
        timestamp: Date.now(),
        comments: []
    };

    posts.push(newPost);
    localStorage.setItem('posts', JSON.stringify(posts));

    savePostToIndexedDB(newPost);

    renderFeed();
    if (currentUser.role === 'admin') updateAdminStats();
    closePublishModal();

    if (appSettings.notifications) {
        showToast('¡Nueva Publicación!', `@${currentUser.username} ha subido una nueva foto.`);
    } else {
        showToast('¡Publicado!', 'Tu foto se ha publicado correctamente.');
    }
}

// BÚSQUEDA Y ACCESO A PERFILES
function toggleSearchModal() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-result').innerHTML = '<p class="text-center" style="color:#94a3b8; font-size:0.85em; padding-top:15px;">Escribe un nombre de usuario para buscar.</p>';
    openModalById('search-modal');
}

function closeSearchModal() {
    document.getElementById('search-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function searchUser() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const resultContainer = document.getElementById('search-result');
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const exams = JSON.parse(localStorage.getItem('examsDB')) || [];

    if (query === '') {
        resultContainer.innerHTML = '<p class="text-center" style="color:#94a3b8; font-size:0.85em; padding-top:15px;">Escribe un nombre de usuario para buscar.</p>';
        return;
    }

    const foundUser = users.find(u => u.username.toLowerCase() === query);

    if (foundUser) {
        const userPostsCount = posts.filter(p => p.author === foundUser.username).length;
        const userExamsCount = exams.filter(e => e.author === foundUser.username).length;

        resultContainer.innerHTML = `
            <div class="user-profile-card animate-pop">
                <div class="profile-avatar-large">${foundUser.username.charAt(0).toUpperCase()}</div>
                <div class="profile-name">${foundUser.fullName}</div>
                <div class="profile-username">@${foundUser.username} ${foundUser.isPrivate ? '🔒' : ''}</div>

                <div class="profile-info-grid">
                    ${foundUser.role !== 'admin' ? `<div class="profile-info-item"><span>${foundUser.age}</span> Edad</div>` : ''}
                    <div class="profile-info-item"><span>${userPostsCount}</span> Fotos</div>
                    <div class="profile-info-item"><span>${userExamsCount}</span> Repasos</div>
                </div>

                <button class="btn btn-secondary-glass btn-block mt-15" onclick="openUserPublicProfile('${foundUser.username}')">
                    <i class="fa-solid fa-user"></i> ${foundUser.isPrivate ? 'Cuenta Privada (Bloqueado)' : 'Ver perfil, fotos y repasos'}
                </button>
            </div>
        `;
    } else {
        resultContainer.innerHTML = `
            <div class="not-found-box animate-pop">
                <i class="fa-solid fa-user-slash" style="font-size:1.5em; margin-bottom:6px; display:block;"></i>
                El usuario "@${query}" no existe
            </div>
        `;
    }
}

// MODALES BIENVENIDA
function showWelcomeModal() { openModalById('welcome-modal'); }
function showLoginModal() { openModalById('login-modal'); }
function showRegisterModal() { openModalById('register-modal'); }

function proceedAsGuest() {
    closeAllModals();
    isGuestMode = true;
    currentUser = null;
    updateUI();
    showToast('Modo Lectura', 'Estás navegando como invitado.', 'warning');
}

function showToast(title, message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');
    const toastIconBg = document.getElementById('toast-icon-bg');

    toastTitle.innerText = title;
    toastMsg.innerText = message;

    if (type === 'warning') {
        toastIcon.className = 'fa-solid fa-triangle-exclamation';
        toastIconBg.style.background = '#fef3c7';
        toastIconBg.style.color = '#d97706';
    } else {
        toastIcon.className = 'fa-solid fa-circle-check';
        toastIconBg.style.background = '#dcfce7';
        toastIconBg.style.color = '#16a34a';
    }

    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

function updateUI() {
    const userControls = document.getElementById('user-controls');
    const guestBanner = document.getElementById('guest-banner');
    const adminNavBtn = document.getElementById('admin-nav-btn');
    const profileLabel = document.getElementById('profile-label');
    const navAvatar = document.getElementById('nav-avatar');

    if (currentUser) {
        isGuestMode = false;
        guestBanner.style.display = 'none';
        profileLabel.innerText = currentUser.username;
        navAvatar.innerText = currentUser.username.charAt(0).toUpperCase();

        userControls.innerHTML = `
            <button onclick="logout()" class="btn btn-danger-glass">
                <i class="fa-solid fa-power-off"></i> Salir
            </button>
        `;

        adminNavBtn.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
        checkUnreadGlobal();
    } else {
        profileLabel.innerText = 'Perfil';
        navAvatar.innerText = '?';
        guestBanner.style.display = 'flex';
        adminNavBtn.style.display = 'none';

        userControls.innerHTML = `
            <button onclick="showWelcomeModal()" class="btn btn-gradient">
                <i class="fa-solid fa-right-to-bracket"></i> Ingresar
            </button>
        `;
    }
}

// RENDER FEED CON COMENTARIOS Y NOTIFICACIONES
function renderFeed() {
    const feed = document.getElementById('feed');
    let posts = JSON.parse(localStorage.getItem('posts')) || [];
    feed.innerHTML = '';

    if (activeHashtagFilter) {
        posts = posts.filter(p => p.caption.includes(activeHashtagFilter));
    }

    const preferredCareers = appSettings.preferredCareers || [];

    posts = posts.slice().reverse().sort((a, b) => {
        const aMatches = preferredCareers.includes(a.career) ? 1 : 0;
        const bMatches = preferredCareers.includes(b.career) ? 1 : 0;
        return bMatches - aMatches;
    });

    if (posts.length === 0) {
        feed.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px 0;">No hay publicaciones disponibles con este criterio.</p>';
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';

        let commentsHTML = post.comments.map(c => `
            <div class="comment-item"><span class="comment-author">@${c.author}:</span> ${c.text}</div>
        `).join('');

        let commentFormHTML = currentUser 
            ? `<form onsubmit="addComment(event, ${post.id})" style="margin-top:10px;">
                <input type="text" placeholder="Escribe un comentario..." required style="padding-left:14px;">
               </form>`
            : `<p style="font-size:0.8em; color:#94a3b8; margin-top:8px;"><a href="#" onclick="showWelcomeModal()" style="color:#6366f1;">Inicia sesión</a> para comentar.</p>`;

        const timeText = getTimeAgo(post.timestamp);
        const isMyPost = currentUser && (currentUser.username === post.author || currentUser.role === 'admin');

        card.innerHTML = `
            <div class="post-header">
                <div class="post-user-wrapper">
                    <div class="post-avatar">${post.author.charAt(0).toUpperCase()}</div>
                    <div class="post-author-info">
                        <span class="post-author">@${post.author}</span>
                        <span class="post-time" data-timestamp="${post.timestamp}">${timeText}</span>
                    </div>
                </div>
                ${isMyPost ? `<button class="post-menu-btn" title="Eliminar publicación" onclick="deletePost(${post.id})"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </div>
            ${post.career ? `<span class="post-career-tag"><i class="fa-solid fa-graduation-cap"></i> ${post.career}</span>` : ''}
            <img src="${post.imageUrl}" class="post-img" alt="Foto del post" onclick="openLightboxModal('${post.imageUrl}')" onerror="this.src='https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80'">
            <p class="post-caption">${post.caption}</p>
            <div class="post-actions">
                <button class="like-btn" onclick="likePost(${post.id})">
                    <i class="fa-solid fa-heart"></i> ${post.likes} Likes
                </button>
                <button class="share-btn" onclick="openShareModal(${post.id})"><i class="fa-solid fa-share-nodes"></i> Compartir</button>
                <button class="save-post-btn ${isPostSaved(post.id) ? 'is-saved' : ''}" onclick="toggleSavedPost(${post.id})" aria-label="Guardar publicación"><i class="fa-${isPostSaved(post.id) ? 'solid' : 'regular'} fa-bookmark"></i> ${isPostSaved(post.id) ? 'Guardado' : 'Guardar'}</button>
            </div>
            <div class="comments-container">
                ${commentsHTML}
                ${commentFormHTML}
            </div>
        `;
        feed.appendChild(card);
    });
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const userVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-password').value.trim();
    const users = JSON.parse(localStorage.getItem('users'));

    const found = users.find(u => u.username === userVal && u.password === passVal);

    if (!found) {
        showToast('Error de Ingreso', 'Usuario o contraseña incorrectos.', 'warning');
        return;
    }

    currentUser = found;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    closeAllModals();
    updateUI();
    showToast('¡Ingreso Exitoso!', `Bienvenido de nuevo @${currentUser.username}`);
});

document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fullname = document.getElementById('reg-fullname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const age = document.getElementById('reg-age').value.trim();
    const users = JSON.parse(localStorage.getItem('users'));

    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        showToast('Usuario No Disponible', 'El nombre de usuario ya está registrado.', 'warning');
        return;
    }

    const newUser = { fullName: fullname, username: username, password: password, age: age, role: 'user', isPrivate: false };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    currentUser = newUser;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    closeAllModals();
    updateUI();
    showToast('¡Cuenta Creada!', `Bienvenido a MiUMGapp, ${fullname}.`);
});

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUI();
    closeAllModals();
    showWelcomeModal();
    showToast('Sesión Cerrada', 'Has salido correctamente.');
}

function likePost(postId) {
    if (!currentUser) { showWelcomeModal(); return; }
    const posts = JSON.parse(localStorage.getItem('posts'));
    const post = posts.find(p => p.id === postId);

    if (post) {
        post.likes += 1;
        localStorage.setItem('posts', JSON.stringify(posts));

        if (post.author !== currentUser.username) {
            userNotifications.push({
                id: Date.now(),
                type: 'like',
                targetUser: post.author,
                fromUser: currentUser.username,
                postId: post.id,
                read: false,
                timestamp: Date.now()
            });
            localStorage.setItem('userNotifications', JSON.stringify(userNotifications));
    persistCampusCollection('userNotifications', userNotifications);
        }

        renderFeed();
        if (currentUser.role === 'admin') updateAdminStats();
    }
}

function addComment(e, postId) {
    e.preventDefault();
    if (!currentUser) return showWelcomeModal();

    const input = e.target.querySelector('input');
    const text = input.value.trim();
    if (!text) return;

    const posts = JSON.parse(localStorage.getItem('posts'));
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.comments.push({ author: currentUser.username, text: text });
        localStorage.setItem('posts', JSON.stringify(posts));

        if (post.author !== currentUser.username) {
            userNotifications.push({
                id: Date.now(),
                type: 'comment',
                targetUser: post.author,
                fromUser: currentUser.username,
                postId: post.id,
                commentText: text,
                read: false,
                timestamp: Date.now()
            });
            localStorage.setItem('userNotifications', JSON.stringify(userNotifications));
    persistCampusCollection('userNotifications', userNotifications);
        }

        renderFeed();
    }
}

function updateAdminStats() {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const posts = JSON.parse(localStorage.getItem('posts')) || [];
    const totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);

    document.getElementById('stat-visits').innerText = localStorage.getItem('visitCount');
    document.getElementById('stat-users').innerText = users.length;
    document.getElementById('stat-posts').innerText = posts.length;
    document.getElementById('stat-likes').innerText = totalLikes;

    const usersList = document.getElementById('users-list');
    usersList.innerHTML = users.map(u => `
        <li>
            <span><strong>@${u.username}</strong> (${u.fullName}${u.role !== 'admin' ? `, ${u.age} años` : ''}) ${u.isPrivate ? '🔒' : ''}</span>
            <span style="font-weight:700; color:${u.role === 'admin' ? '#a855f7' : '#64748b'};">${u.role.toUpperCase()}</span>
        </li>
    `).join('');
}

function handleRestrictedAction(actionName) {
    if (!currentUser) {
        showWelcomeModal();
    } else {
        showToast('En Desarrollo', `La opción de ${actionName} estará disponible pronto.`);
    }
}

function handleProfileClick() {
    openProfileModal();
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* MiUMGapp 2.0: herramientas comunitarias mejoradas */
let focusInterval=null, focusSeconds=25*60;
function readCampusData(key){try{return JSON.parse(localStorage.getItem(key))||[]}catch(e){return[]}}
function writeCampusData(key,value){
    localStorage.setItem(key,JSON.stringify(value));
    persistCampusCollection(key,value);
}
function escapeCampusText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getSavedPostIds(){if(!currentUser)return[];const all=JSON.parse(localStorage.getItem('campusSavedPosts')||'{}');return Array.isArray(all[currentUser.username])?all[currentUser.username]:[]}
function isPostSaved(id){return getSavedPostIds().includes(id)}
function toggleSavedPost(id){if(!currentUser){showWelcomeModal();return}const all=JSON.parse(localStorage.getItem('campusSavedPosts')||'{}');const ids=Array.isArray(all[currentUser.username])?all[currentUser.username]:[];const index=ids.indexOf(id);if(index>=0){ids.splice(index,1);showToast('Eliminado de guardados','La publicación salió de tu colección.')}else{ids.unshift(id);showToast('Publicación guardada','La encontrarás en Mis guardados.')}all[currentUser.username]=ids;localStorage.setItem('campusSavedPosts',JSON.stringify(all));persistSavedPosts(currentUser.username,ids);renderFeed()}
function openCampusFeature(feature){const content=document.getElementById('campus-feature-content');if(!content)return;const cfg={saved:['MIS GUARDADOS','Tu colección universitaria','Guarda publicaciones que quieras consultar después.'],events:['AGENDA U','Eventos y actividades','Publica actividades y reacciona con emojis.'],market:['INTERCAMBIO U','Mercado entre estudiantes','Coordina el punto y la hora para entregar o intercambiar artículos.'],study:['CÍRCULOS DE ESTUDIO','Aprender en equipo','Envía tu respuesta a la invitación; el creador recibirá los datos del estudiante.'],focus:['MODO ENFOQUE','Una sesión a la vez','Organiza 25 minutos de concentración y toma un descanso.']};if(!cfg[feature])return;let body=feature==='saved'?renderSavedPosts():feature==='events'?renderCampusEntries('campusEvents','event'):feature==='market'?renderCampusEntries('campusMarket','market'):feature==='study'?renderCampusEntries('campusStudyGroups','study'):renderFocusTimer();content.innerHTML=`<div class="feature-head"><span class="feature-kicker">${cfg[feature][0]}</span><h2>${cfg[feature][1]}</h2><p>${cfg[feature][2]}</p></div>${body}`;openModalById('campus-feature-modal');if(feature==='focus')updateFocusClock()}
function closeCampusFeature(){document.getElementById('campus-feature-modal')?.classList.remove('active');document.body.classList.remove('modal-open')}
function renderSavedPosts(){if(!currentUser)return'<div class="feature-empty">Inicia sesión para crear tu colección.</div><div class="feature-actions"><button class="btn btn-gradient" onclick="showWelcomeModal()">Iniciar sesión</button></div>';const ids=getSavedPostIds();const posts=(JSON.parse(localStorage.getItem('posts'))||[]).filter(p=>ids.includes(p.id));if(!posts.length)return'<div class="feature-empty"><i class="fa-regular fa-bookmark"></i><br><br>Aún no guardas publicaciones.<br>Usa el botón Guardar en cualquier publicación.</div>';return`<div class="feature-list">${posts.map(p=>`<article class="feature-entry"><strong>@${escapeCampusText(p.author)}</strong><p>${escapeCampusText(p.caption)}</p><div class="entry-meta">${escapeCampusText(p.career||'Comunidad UMG')} · ${p.likes||0} likes</div><div class="feature-actions"><button class="btn btn-sm btn-secondary-glass" onclick="toggleSavedPost(${Number(p.id)});openCampusFeature('saved')">Quitar de guardados</button></div></article>`).join('')}</div>`}
function renderCampusEntries(key,type){const entries=readCampusData(key).slice().reverse();let list='';if(entries.length){list=`<div class="feature-list">${entries.map(x=>{if(type==='event')return renderEventEntry(x);if(type==='market')return renderMarketEntry(x);return renderStudyEntry(x)}).join('')}</div>`}else{list='<div class="feature-empty">Todavía no hay publicaciones aquí. ¡Inaugura este espacio!</div>'}const label=type==='event'?'Publicar evento':type==='market'?'Publicar intercambio':'Crear círculo';return`${list}<div class="feature-actions"><button class="btn btn-gradient" onclick="showCampusEntryForm('${type}')"><i class="fa-solid fa-plus"></i> ${label}</button></div>`}
function renderEventEntry(x){const reactions=x.reactions||{};const emojis=['👍','❤️','🎉','😍','🙌'];return`<article class="feature-entry"><strong>${escapeCampusText(x.title)}</strong><p>${escapeCampusText(x.description)}</p><div class="entry-meta"><i class="fa-regular fa-calendar"></i> ${escapeCampusText(x.detail)} · ${escapeCampusText(x.contact)} · @${escapeCampusText(x.author)}</div><div class="emoji-reactions" aria-label="Reacciones">${emojis.map(emoji=>`<button class="emoji-reaction ${reactions[emoji]?.includes(currentUser?.username)?'selected':''}" onclick="reactToCampusEvent(${Number(x.id)},'${emoji}')" aria-label="Reaccionar ${emoji}">${emoji}<span>${(reactions[emoji]||[]).length}</span></button>`).join('')}</div></article>`}
function renderMarketEntry(x){return`<article class="feature-entry"><strong>${escapeCampusText(x.title)}</strong><p>${escapeCampusText(x.description)}</p><div class="market-details"><span><i class="fa-solid fa-location-dot"></i> ${escapeCampusText(x.meetingPoint||'Por coordinar')}</span><span><i class="fa-regular fa-clock"></i> ${escapeCampusText(x.meetingTime||'Por coordinar')}</span><span><i class="fa-solid fa-user"></i> ${escapeCampusText(x.studentName||x.author)}</span></div><div class="entry-meta">Publicado por @${escapeCampusText(x.author)}</div></article>`}
function renderStudyEntry(x){const responses=x.responses||{};const already= currentUser && responses[currentUser.username];const own=currentUser&&x.author===currentUser.username;return`<article class="feature-entry"><strong>${escapeCampusText(x.title)}</strong><p>${escapeCampusText(x.description)}</p><div class="entry-meta">Materia: ${escapeCampusText(x.subject||x.title)} · Horario: ${escapeCampusText(x.schedule||x.detail)} · Lugar: ${escapeCampusText(x.meetingPoint||x.contact)} · @${escapeCampusText(x.author)}</div>${own?'<p class="study-status">Este es tu círculo. Las respuestas de los estudiantes llegarán a tus notificaciones.</p>':!currentUser?'<button class="btn btn-sm btn-gradient" onclick="showWelcomeModal()">Inicia sesión para responder</button>':already?`<p class="study-status">Ya respondiste: ${already==='accepted'?'aceptaste':'rechazaste'} esta invitación.</p>`:`<div class="study-invite-actions"><button class="btn btn-sm btn-gradient" onclick="respondToStudyInvite(${Number(x.id)},'accepted')"><i class="fa-solid fa-check"></i> Aceptar invitación</button><button class="btn btn-sm btn-secondary-glass" onclick="respondToStudyInvite(${Number(x.id)},'rejected')"><i class="fa-solid fa-xmark"></i> Rechazar invitación</button></div>`}</article>`}
function showCampusEntryForm(type){if(!currentUser){showWelcomeModal();return}const target=document.getElementById('campus-entry-form');if(!target)return;const forms={event:`<form id="campus-entry-data-form" onsubmit="submitCampusEntry(event,'event')"><label>Nombre del evento</label><input name="title" required maxlength="90" placeholder="Ej. Feria de proyectos"><label>Fecha y hora</label><input name="detail" type="datetime-local" required><label>Lugar o modalidad</label><input name="contact" required maxlength="100" placeholder="Ej. Campus central / virtual"><label>Descripción</label><textarea name="description" required maxlength="500" placeholder="Detalles de la actividad"></textarea><button class="btn btn-gradient btn-block" type="submit">Publicar evento</button></form>`,market:`<form id="campus-entry-data-form" onsubmit="submitCampusEntry(event,'market')"><label>Nombre del artículo</label><input name="title" required maxlength="90" placeholder="Ej. Libro de cálculo"><label>Nombre de quien entrega</label><input name="studentName" required maxlength="90" value="${escapeCampusText(currentUser.fullName||currentUser.username)}"><label>Punto de intercambio</label><input name="meetingPoint" required maxlength="120" placeholder="Ej. Cafetería del campus"><label>Hora del intercambio</label><input name="meetingTime" type="time" required><label>Detalles del artículo / qué ofreces</label><textarea name="description" required maxlength="500" placeholder="Estado, precio o artículo que buscas a cambio"></textarea><label class="check-row"><input type="checkbox" name="confirm" required> Confirmo que los datos del intercambio son correctos.</label><button class="btn btn-gradient btn-block" type="submit">Publicar intercambio</button></form>`,study:`<form id="campus-entry-data-form" onsubmit="submitCampusEntry(event,'study')"><label>Materia o tema</label><input name="title" required maxlength="90" placeholder="Ej. Programación II"><label>Nombre del estudiante que organiza</label><input name="studentName" required maxlength="90" value="${escapeCampusText(currentUser.fullName||currentUser.username)}"><label>Horario disponible</label><input name="schedule" required maxlength="100" placeholder="Ej. Martes y jueves, 15:00"><label>Lugar o modalidad</label><input name="meetingPoint" required maxlength="120" placeholder="Ej. Biblioteca / virtual"><label>Descripción</label><textarea name="description" required maxlength="500" placeholder="Qué desean estudiar y qué compañeros buscan"></textarea><button class="btn btn-gradient btn-block" type="submit">Crear círculo</button></form>`};target.innerHTML=`<div class="entry-form-panel"><h3>${type==='event'?'Nuevo evento':type==='market'?'Nuevo intercambio':'Nuevo círculo de estudio'}</h3>${forms[type]}<button class="btn btn-sm btn-secondary-glass cancel-form" type="button" onclick="cancelCampusEntryForm()">Cancelar</button></div>`;target.scrollIntoView({behavior:'smooth',block:'nearest'})}
function cancelCampusEntryForm(){const target=document.getElementById('campus-entry-form');if(target)target.innerHTML=''}
function submitCampusEntry(event,type){event.preventDefault();if(!currentUser){showWelcomeModal();return}const form=event.currentTarget;const data=Object.fromEntries(new FormData(form).entries());if(type==='market'&&!data.confirm)return;const key=type==='event'?'campusEvents':type==='market'?'campusMarket':'campusStudyGroups';const entry={id:Date.now(),title:data.title.trim(),description:data.description.trim(),author:currentUser.username,createdAt:Date.now()};if(type==='event'){entry.detail=data.detail;entry.contact=data.contact;entry.reactions={}}if(type==='market'){entry.studentName=data.studentName.trim();entry.meetingPoint=data.meetingPoint.trim();entry.meetingTime=data.meetingTime;entry.confirmed=true}if(type==='study'){entry.studentName=data.studentName.trim();entry.subject=data.title.trim();entry.schedule=data.schedule.trim();entry.meetingPoint=data.meetingPoint.trim();entry.responses={}}const all=readCampusData(key);all.push(entry);writeCampusData(key,all);openCampusFeature(type==='event'?'events':type==='market'?'market':'study');showToast('¡Publicado!','Tu publicación ya está disponible en la comunidad.')}
function reactToCampusEvent(eventId,emoji){if(!currentUser){showWelcomeModal();return}const events=readCampusData('campusEvents');const item=events.find(x=>x.id===eventId);if(!item)return;item.reactions=item.reactions||{};item.reactions[emoji]=item.reactions[emoji]||[];const idx=item.reactions[emoji].indexOf(currentUser.username);if(idx>=0)item.reactions[emoji].splice(idx,1);else item.reactions[emoji].push(currentUser.username);writeCampusData('campusEvents',events);openCampusFeature('events')}
function respondToStudyInvite(circleId,response){if(!currentUser){showWelcomeModal();return}const circles=readCampusData('campusStudyGroups');const circle=circles.find(x=>x.id===circleId);if(!circle||circle.author===currentUser.username)return;circle.responses=circle.responses||{};if(circle.responses[currentUser.username]){showToast('Respuesta registrada','Ya respondiste a esta invitación.');return}circle.responses[currentUser.username]=response;writeCampusData('campusStudyGroups',circles);userNotifications=JSON.parse(localStorage.getItem('userNotifications')||'[]');userNotifications.push({id:Date.now(),type:'study_response',targetUser:circle.author,fromUser:currentUser.username,studentName:currentUser.fullName||currentUser.username,circleTitle:circle.title,subject:circle.subject||circle.title,schedule:circle.schedule||circle.detail,meetingPoint:circle.meetingPoint||circle.contact,response,read:false,timestamp:Date.now()});localStorage.setItem('userNotifications',JSON.stringify(userNotifications));persistCampusCollection('userNotifications',userNotifications);openCampusFeature('study');showToast(response==='accepted'?'¡Invitación aceptada!':'Respuesta enviada',`Se notificó a @${circle.author} con tus datos de estudiante.`)}
function renderFocusTimer(){return`<div class="focus-clock"><span class="feature-kicker">POMODORO</span><strong id="focus-clock-display">25:00</strong><p id="focus-clock-status">Listo para comenzar. Silencia las distracciones y concéntrate.</p><div class="feature-actions"><button class="btn btn-gradient" onclick="startFocusTimer()"><i class="fa-solid fa-play"></i> Comenzar</button><button class="btn btn-secondary-glass" onclick="pauseFocusTimer()"><i class="fa-solid fa-pause"></i> Pausar</button><button class="btn btn-secondary-glass" onclick="resetFocusTimer()"><i class="fa-solid fa-rotate-left"></i> Reiniciar</button></div></div>`}
function updateFocusClock(){const el=document.getElementById('focus-clock-display');if(el)el.textContent=String(Math.floor(focusSeconds/60)).padStart(2,'0')+':'+String(focusSeconds%60).padStart(2,'0')}
function startFocusTimer(){if(focusInterval)return;const status=document.getElementById('focus-clock-status');if(status)status.textContent='Sesión en marcha. ¡Tú puedes!';focusInterval=setInterval(()=>{focusSeconds=Math.max(0,focusSeconds-1);updateFocusClock();if(focusSeconds===0){pauseFocusTimer();if(status)status.textContent='¡Excelente trabajo! Terminaste tus 25 minutos. Tómate un descanso.';showToast('¡Sesión completada!','Terminaste un bloque de concentración.')}},1000)}
function pauseFocusTimer(){if(focusInterval)clearInterval(focusInterval);focusInterval=null;const status=document.getElementById('focus-clock-status');if(status&&focusSeconds>0)status.textContent='Sesión pausada. Continúa cuando estés listo.'}
function resetFocusTimer(){pauseFocusTimer();focusSeconds=25*60;updateFocusClock();const status=document.getElementById('focus-clock-status');if(status)status.textContent='Temporizador reiniciado. ¡Vamos de nuevo!'}
