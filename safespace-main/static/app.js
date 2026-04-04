let token = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let intendedRole = 'user';

// Ensure standard entry behavior
if (token) {
    let landing = document.getElementById('landingPage');
    if(landing) landing.style.display = 'none';
    document.getElementById('mainUI').style.display = 'block';
    
    // Redirect admin to admin dashboard physically
    if (currentRole === 'admin' && !window.location.pathname.includes('/admin')) {
        window.location.href = '/admin';
    } else if (currentRole !== 'admin' && window.location.pathname.includes('/admin')) {
        window.location.href = '/';
    } else {
        if (!window.location.pathname.includes('/admin')) {
            loadFeed();
        }
    }
}

let isRegisterMode = false;

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const submitBtn = document.getElementById('submitBtn');
    const toggleBtn = document.getElementById('toggleAuthBtn');
    const authTitle = document.getElementById('authTitle');
    
    document.getElementById('authError').style.display = 'none';

    document.getElementById('emailGroup').style.display = isRegisterMode ? 'block' : 'none';
    document.getElementById('confirmGroup').style.display = isRegisterMode ? 'block' : 'none';

    if (isRegisterMode) {
        authTitle.innerText = "Register Account";
        submitBtn.innerText = "Create Account";
        submitBtn.onclick = function() { handleAuth(false); };
        toggleBtn.innerHTML = "Already have an account? <u>Click here to Login</u>";
    } else {
        authTitle.innerText = "User Login";
        submitBtn.innerText = "Login";
        submitBtn.onclick = function() { handleAuth(true); };
        toggleBtn.innerHTML = "New User? <u>Click here to Register</u>";
    }
}

function showLoginForm(role) {
    intendedRole = role;
    isRegisterMode = false;
    document.getElementById('loginOptions').style.display = 'none';
    document.getElementById('authForm').style.display = 'block';
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = "Login";
    submitBtn.onclick = function() { handleAuth(true); };
    
    document.getElementById('emailGroup').style.display = 'none';
    document.getElementById('confirmGroup').style.display = 'none';
    
    const toggleBtn = document.getElementById('toggleAuthBtn');
    toggleBtn.innerHTML = "New User? <u>Click here to Register</u>";
    toggleBtn.style.display = 'block';
    
    if (role === 'admin') {
        document.getElementById('authTitle').innerText = "Admin Area";
        toggleBtn.style.display = 'none';
    } else {
        document.getElementById('authTitle').innerText = "User Login";
    }
}

function backToOptions() {
    document.getElementById('loginOptions').style.display = 'flex';
    document.getElementById('authForm').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('authError').style.display = 'none';
}

async function handleAuth(isLogin) {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const confirm = document.getElementById('confirmPassword').value;
    const errObj = document.getElementById('authError');
    errObj.style.display = 'none';

    if (!user || !pass) {
        errObj.innerText = "Please enter both username and password.";
        errObj.style.display = 'block';
        return;
    }
    
    if (!isLogin) {
        if (!email) {
            errObj.innerText = "Please enter an email address.";
            errObj.style.display = 'block';
            return;
        }
        if (pass !== confirm) {
            errObj.innerText = "Passwords do not match.";
            errObj.style.display = 'block';
            return;
        }
    }

    try {
        let endpoint = isLogin ? '/api/login' : '/api/register';
        let bodyDat = null;
        let headers = {};
        
        if (isLogin) {
            bodyDat = new URLSearchParams({"username": user, "password": pass});
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else {
            bodyDat = JSON.stringify({"username": user, "email": email, "password": pass});
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: bodyDat
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.detail || "Authentication error");
        }

        if (!isLogin) {
            // After register, do login auto
            await handleAuth(true);
        } else {
            // Check if intended role matches active DB role logic or simply pass them through and restrict via backend endpoints implicitly
            // Since we rely on JWT role checks for endpoints, we redirect based on db response.
            if (intendedRole === 'admin' && data.role !== 'admin') {
                throw new Error("Account does not have admin privileges.");
            }
            
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            window.location.reload();
        }
    } catch (e) {
        errObj.innerText = e.message;
        errObj.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/';
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId + 'Tab').classList.add('active');
    document.getElementById('nav-' + tabId).classList.add('active');

    if (tabId === 'feed') loadFeed();
    if (tabId === 'profile') loadProfile();
}

async function apiCall(endpoint, options = {}) {
    if (!options.headers) options.headers = {};
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(endpoint, options);
    const data = await res.json();
    
    if (res.status === 401 || res.status === 403) {
        if(data.detail?.includes("blocked")) {
            alert("Blocked: " + data.detail);
        } else {
            logout();
        }
        throw new Error(data.detail);
    }
    
    if (!res.ok) {
        throw {status: res.status, message: data.detail || "Server error"};
    }
    return data;
}

// ------ FEED ------
async function loadFeed() {
    if (!document.getElementById('feedStyles')) {
        const style = document.createElement('style');
        style.id = 'feedStyles';
        style.innerHTML = `
            @keyframes slideUp { from {opacity:0; transform:translateY(30px) scale(0.95);} to {opacity:1; transform:translateY(0) scale(1);} }
            .post-card { background: linear-gradient(145deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.8) 100%); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 0 !important; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease; margin-bottom: 2.5rem; }
            .post-card:hover { transform: translateY(-8px); box-shadow: 0 30px 50px rgba(0,229,188,0.15); border-color: rgba(0,229,188,0.2); }
            .post-image-container { margin:0; width:100%; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); overflow:hidden; }
            .post-image { transition: transform 0.5s ease-out; width: 100%; display: block; border-radius: 0 !important; }
            .post-image:hover { transform: scale(1.05); }
            .action-btn { transition: all 0.2s ease; background: transparent; border: none; padding: 0.5rem 1rem; color: #94a3b8; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; font-family: inherit; font-size: 0.95rem; border-radius: 12px; }
            .action-btn.like-btn svg { fill: transparent; stroke: currentColor; stroke-width: 2; transition: all 0.3s; }
            .action-btn.like-btn:hover { background: rgba(244, 63, 94, 0.1); color: #f43f5e; }
            .action-btn.like-btn.liked { color: #f43f5e; }
            .action-btn.like-btn.liked svg { fill: #f43f5e; stroke: none; animation: heartBurst 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            .action-btn.comment-btn:hover { background: rgba(0, 229, 188, 0.1); color: #00e5bc; }
            .action-btn.share-btn:hover { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
            @keyframes heartBurst { 0% {transform: scale(0.5); opacity:0;} 50% {transform: scale(1.3);} 100% {transform: scale(1); opacity:1;} }
            .comment { padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.02); margin-bottom: 0.75rem; font-size: 0.95rem; border: 1px solid rgba(255,255,255,0.03); transition: background 0.2s; }
            .comment:hover { background: rgba(255,255,255,0.05); }
            .comment-input-area input:focus { box-shadow: 0 0 0 2px rgba(0, 229, 188, 0.3); outline: none; border-color: transparent !important; }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(style);
    }

    try {
        const posts = await apiCall('/api/posts');
        const fContainer = document.getElementById('feedContainer');
        fContainer.innerHTML = '';
        
        if (posts.length === 0) fContainer.innerHTML = '<div style="text-align:center; padding: 3rem; color: var(--text-secondary);">No posts yet. Be the first to share!</div>';

        posts.forEach((p, idx) => {
            let commentsHtml = p.comments.map(c => `
                <div class="comment"><strong>${c.username}:</strong> <span style="color:var(--text-secondary)">${c.content}</span></div>
            `).join('');

            let pCard = document.createElement('div');
            pCard.className = 'post-card glass';
            pCard.style.animation = `slideUp 0.4s ease forwards ${idx * 0.05}s`;
            pCard.style.opacity = '0';
            
            pCard.innerHTML = `
                <div style="padding: 1.5rem; padding-bottom: 1rem; display:flex; align-items:center; gap:1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; display:flex; align-items:center; justify-content:center; background: linear-gradient(135deg, #00e5bc, #6366f1); color: white; font-size: 1.2rem; font-weight: bold; box-shadow: 0 4px 15px rgba(0,229,188,0.3); border: 2px solid rgba(255,255,255,0.1);">${p.username.charAt(0).toUpperCase()}</div>
                    <div style="display:flex; flex-direction:column;">
                        <strong style="font-size: 1.15rem; letter-spacing: 0.5px;">${p.username}</strong>
                        <span style="font-size: 0.8rem; color: #94a3b8; margin-top:0.2rem;">${new Date(p.created_at || Date.now()).toLocaleString()}</span>
                    </div>
                    <div style="margin-left: auto; cursor:pointer; color: #94a3b8; padding: 0.5rem; border-radius: 50%; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    </div>
                </div>
                
                ${p.description ? `<div style="padding: 0 1.5rem 1.25rem 1.5rem; font-size:1.1rem; line-height:1.6; color: #e2e8f0;">${p.description}</div>` : ''}
                
                ${p.image_path ? `
                <div class="post-image-container">
                    <img src="${p.image_path}" class="post-image" onerror="this.style.display='none'">
                </div>` : ''}
                
                <div style="display:flex; gap: 0.5rem; padding: 1rem 1.5rem; background: rgba(0,0,0,0.1); border-bottom: 1px solid rgba(255,255,255,0.02);">
                    <button class="action-btn like-btn ${p.likes && p.likes.includes(localStorage.getItem('token')) ? 'liked' : ''}" onclick="toggleLike(${p.id}, this)">
                        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> 
                        <span id="likeCount-${p.id}">${p.likes ? p.likes.length : 0}</span>
                    </button>
                    <button class="action-btn comment-btn" onclick="toggleComments(${p.id})">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span id="commentCount-${p.id}">${p.comments ? p.comments.length : 0}</span>
                    </button>
                    <button class="action-btn share-btn" style="margin-left: auto;" onclick="alert('Link copied to clipboard')">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                </div>
                
                <div id="commentError-${p.id}" class="cyberbullying-alert" style="display:none; margin: 1rem 1.5rem; padding:0.75rem; font-size:0.875rem;"></div>
                
                <div class="comments-wrapper" id="comments-wrapper-${p.id}" style="display: none; padding: 1.5rem;">
                    <div class="comments-section" id="comments-${p.id}" style="max-height: 250px; overflow-y: auto; padding-right: 0.5rem; margin-bottom: 1rem;">
                        ${commentsHtml || '<div class="comment" style="text-align:center; opacity:0.5; background: transparent; border:none;">No comments yet. Be the first!</div>'}
                    </div>
                </div>
                
                <div class="comment-input-area" style="display:flex; gap: 0.75rem; padding: 0 1.5rem 1.5rem 1.5rem;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; display:flex; align-items:center; justify-content:center; background: linear-gradient(135deg, #10b981, #3b82f6); color: white; flex-shrink: 0;">U</div>
                    <input type="text" id="cmapInp-${p.id}" class="input-field" style="border-radius: 20px; padding-left: 1.25rem; font-size:0.95rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);" placeholder="Add a comment..." onkeypress="if(event.key === 'Enter') postComment(${p.id})">
                    <button class="btn btn-primary" style="border-radius: 20px; padding: 0.5rem 1.5rem; font-weight: bold; background: linear-gradient(90deg, #00e5bc, #6366f1); border:none;" onclick="postComment(${p.id})">Post</button>
                </div>
            `;
            fContainer.appendChild(pCard);
        });
    } catch(e) { console.error(e); }
}

window.toggleComments = function(postId) {
    const w = document.getElementById(`comments-wrapper-${postId}`);
    if(w.style.display === 'none') {
        w.style.display = 'block';
        w.style.animation = 'slideUp 0.2s ease forwards';
    } else {
        w.style.display = 'none';
    }
};

async function toggleLike(postId, btnEl) {
    try {
        await apiCall(`/api/posts/${postId}/like`, { method: 'POST' });
        // Silently update post likes
        const posts = await apiCall('/api/posts');
        const p = posts.find(x => x.id === postId);
        if (p) {
            document.getElementById(`likeCount-${postId}`).innerText = p.likes ? p.likes.length : 0;
            btnEl.classList.remove('liked');
            void btnEl.offsetWidth; // Trigger reflow for animation
            btnEl.classList.add('liked');
        }
    } catch(e) { console.error("Error liking: ", e); }
}

async function postComment(postId) {
    const inp = document.getElementById(`cmapInp-${postId}`);
    const errBox = document.getElementById(`commentError-${postId}`);
    errBox.style.display = 'none';

    if (!inp.value.trim()) return;

    try {
        await apiCall(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({content: inp.value, post_id: postId})
        });
        inp.value = '';
        
        // Dynamically update without reloading feed layout
        const posts = await apiCall('/api/posts');
        const p = posts.find(x => x.id === postId);
        if (p) {
            document.getElementById(`commentCount-${postId}`).innerText = p.comments.length;
            const cHTML = p.comments.map(c => `
                <div class="comment" style="animation: slideUp 0.3s ease forwards;">
                    <strong>${c.username}:</strong> <span style="color:var(--text-secondary)">${c.content}</span>
                </div>
            `).join('');
            document.getElementById(`comments-${postId}`).innerHTML = cHTML;
            document.getElementById(`comments-wrapper-${postId}`).style.display = 'block'; // Make sure active
        }
    } catch (e) {
        if (e.status === 400 && e.message.includes("blocked")) {
            errBox.innerText = e.message;
            errBox.style.display = 'block';
            setTimeout(() => { if(window.location.pathname === '/') window.location.reload(); }, 3000);
        } else {
            console.error(e);
        }
    }
}

// ------ POST ------
async function uploadPost(isMeme = false) {
    const fileInp = document.getElementById('postImage');
    const descInp = document.getElementById('postDesc');
    const errBox = document.getElementById('postError');
    errBox.style.display = 'none';
    
    if(!fileInp.files[0]) return alert("Please select an image");
    
    const fName = fileInp.files[0].name.toLowerCase();
    if (fName.endsWith('.heic') || fName.endsWith('.heif')) {
        errBox.innerText = "Modern internet browsers cannot mathematically render Apple's proprietary HEIC files natively over standard web views. Please upload a standard JPG or PNG format instead!";
        errBox.style.display = 'block';
        fileInp.value = '';
        return;
    }

    let formData = new FormData();
    formData.append("file", fileInp.files[0]);
    formData.append("description", descInp.value);
    formData.append("is_meme", isMeme ? "true" : "false");

    try {
        await apiCall('/api/posts', {
            method: 'POST',
            body: formData // Fetch sets boundary itself
        });
        alert("Posted successfully");
        fileInp.value = '';
        descInp.value = '';
        switchTab('feed');
    } catch (e) {
        if (e.status === 400 && e.message.includes("blocked")) {
            errBox.innerText = e.message;
            errBox.style.display = 'block';
        } else {
            alert(e.message);
        }
    }
}

// ------ PROFILE ------
async function loadProfile() {
    try {
        const stats = await apiCall('/api/profile/stats');
        
        document.getElementById('profAvatar').innerText = stats.username.charAt(0).toUpperCase();
        document.getElementById('profUsername').innerText = stats.username;
        document.getElementById('profEmail').innerText = stats.email || "No email linked";
        
        document.getElementById('prof-strikes').innerText = stats.strike_count;
        document.getElementById('prof-safety').innerText = stats.hate_measure_percentage + '%';

        const sCont = document.getElementById('strikeContainer');
        if (stats.strikes.length > 0) {
            sCont.innerHTML = stats.strikes.map(s => `
                <div style="padding: 1rem; background: rgba(244, 63, 94, 0.05); border-left: 3px solid #f43f5e; border-radius: 8px; margin-bottom: 0.75rem; display:flex; flex-direction:column; gap:0.25rem;">
                    <strong style="color:#f43f5e; display:flex; align-items:center; gap:0.5rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Detection Modeled
                    </strong> 
                    <span style="color:#cbd5e1; font-size: 0.95rem;">${s.reason}</span>
                    <small style="color:#64748b; font-size: 0.8rem; margin-top:0.25rem;">${new Date(s.created_at).toLocaleString()}</small>
                </div>
            `).join('');
        } else {
            sCont.innerHTML = "<p style='color:var(--text-secondary); text-align:center; margin:0;'>No strikes found. Keep it up!</p>";
        }

        const gCont = document.getElementById('profileGrid');
        gCont.innerHTML = '';
        stats.posts.forEach(p => {
            let div = document.createElement('div');
            div.className = 'grid-item-glass';
            div.style.position = 'relative';
            div.innerHTML = `
                <div style="position:relative; width: 100%; padding-top: 100%; border-radius: 16px; overflow:hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.2);">
                    <img src="${p.image_path}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; transition: transform 0.5s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                    <div style="position:absolute; bottom:0; left:0; right:0; padding:1.5rem 1rem; background:linear-gradient(transparent, rgba(0,0,0,0.9)); display:flex; justify-content:center; align-items:flex-end;">
                        <button class="btn" style="border-radius:12px; padding: 0.4rem 1rem; font-size:0.85rem; font-weight:bold; color: white; background:rgba(244,63,94,0.85); border:1px solid #f43f5e; box-shadow:0 4px 10px rgba(244,63,94,0.4); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#f43f5e'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(244,63,94,0.85)'; this.style.transform='scale(1)'" onclick="deletePost(${p.id})">Delete Post</button>
                    </div>
                </div>
            `;
            gCont.appendChild(div);
        });

    } catch (e) { console.error(e); }
}

function toggleSafetyDetails() {
    const el = document.getElementById('safetyDetails');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function deletePost(postId) {
    if(!confirm("Are you sure?")) return;
    try {
        await apiCall(`/api/posts/${postId}`, { method: 'DELETE' });
        loadProfile();
    } catch (e) {
        console.error(e);
    }
}
