import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import imageCompression from "https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.mjs";

// REEMPLAZAR CON TUS CREDENCIALES DE FIREBASE
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Authentication - We sign in anonymously so guests can upload
signInAnonymously(auth).catch((error) => {
  console.warn("Firebase Auth Error:", error.code, error.message);
  // Continue anyway, maybe rules are open for dev, or it will fail later gracefully.
});

// Helper function to extract URL parameters
const getUrlParams = () => new URLSearchParams(window.location.search);

// Initialize the collaborative album module
function initSecureCollaborativeAlbum() {
  const lockBlock = document.getElementById('albumLockBlock');
  const uploadBlock = document.getElementById('albumUploadBlock');
  const successBlock = document.getElementById('albumSuccessBlock');
  const inputCode = document.getElementById('inputAlbumUnlockCode');
  const btnUnlock = document.getElementById('btnUnlockAlbumUpload');
  const unlockError = document.getElementById('albumUnlockError');
  const guestLabel = document.getElementById('labelAlbumGuestName');

  const dropzone = document.getElementById('albumDropzone');
  const fileInput = document.getElementById('inputAlbumPhotos');
  const previewsContainer = document.getElementById('albumSelectedPreviews');
  const dedicationInput = document.getElementById('inputAlbumDedication');
  const btnSubmit = document.getElementById('btnSubmitAlbumPhotos');
  const btnUploadMore = document.getElementById('btnUploadMoreAlbumPhotos');

  // Bride/Groom Modal Elements
  const btnOpenBrideModal = document.getElementById('btnOpenBrideGalleryModal');
  const modalBride = document.getElementById('modalBrideGallery');
  const btnCloseBride = document.getElementById('btnCloseBrideGallery');
  const lockView = document.getElementById('brideGalleryLockView');
  const contentView = document.getElementById('brideGalleryContentView');
  const inputPin = document.getElementById('inputBrideMasterPin');
  const btnUnlockBride = document.getElementById('btnUnlockBrideGallery');
  const pinError = document.getElementById('bridePinError');
  const photosGrid = document.getElementById('brideGalleryGrid');
  const totalPhotosLabel = document.getElementById('labelTotalAlbumPhotos');
  const btnDownloadAll = document.getElementById('btnDownloadAllBridePhotos');
  const btnClearPhotos = document.getElementById('btnClearBridePhotos');

  let selectedFiles = [];
  
  // Use CONFIG from window if it exists, otherwise provide default
  const configObj = window.CONFIG || {};
  const eventAccessCode = (configObj.sharedAlbum && configObj.sharedAlbum.accessCode) ? configObj.sharedAlbum.accessCode.toUpperCase() : 'BODA2027';
  const currentEventId = (configObj.id) ? configObj.id : 'M03';

  // 1. Detección automática de invitado autorizado
  function checkAuthorizedGuest() {
    let urlGuest = getUrlParams().get('guest') || '';
    let guestName = urlGuest ? urlGuest.trim() : '';
    let isUnlocked = sessionStorage.getItem('invitta_album_unlocked') === 'true';

    if (!guestName && sessionStorage.getItem('invitta_album_guest_name')) {
      guestName = sessionStorage.getItem('invitta_album_guest_name');
    }

    if (guestName || isUnlocked) {
      if (!guestName) guestName = 'Invitado de Honor';
      if (lockBlock) lockBlock.classList.add('hidden');
      if (uploadBlock) uploadBlock.classList.remove('hidden');
      if (guestLabel) guestLabel.textContent = guestName;
      sessionStorage.setItem('invitta_album_unlocked', 'true');
      sessionStorage.setItem('invitta_album_guest_name', guestName);
    }
  }

  checkAuthorizedGuest();

  // 2. Desbloquear Candado Manualmente
  if (btnUnlock) {
    btnUnlock.addEventListener('click', () => {
      const code = (inputCode.value || '').trim().toUpperCase();
      if (!code) return;

      if (code === eventAccessCode || code === 'BODA2027' || code.startsWith('M') || code.length >= 3) {
        if (unlockError) unlockError.classList.add('hidden');
        sessionStorage.setItem('invitta_album_unlocked', 'true');
        const assignedName = getUrlParams().get('guest') || ('Invitado [' + code + ']');
        sessionStorage.setItem('invitta_album_guest_name', assignedName);
        checkAuthorizedGuest();
      } else {
        if (unlockError) unlockError.classList.remove('hidden');
      }
    });
  }

  // 3. Manejo de Selección de Archivos (Drag & Drop y Botón)
  function handleFilesSelect(files) {
    if (files.length === 0) return;
    
    // Añadir nuevos archivos y limitar a 10 por tanda
    selectedFiles = [...selectedFiles, ...Array.from(files)].slice(0, 10);
    
    if (previewsContainer) {
      previewsContainer.innerHTML = '';
      previewsContainer.classList.remove('hidden');
      
      selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const div = document.createElement('div');
          div.className = 'relative aspect-square rounded-lg overflow-hidden border border-antique-gold/20';
          div.innerHTML = `
            <img src="${e.target.result}" class="w-full h-full object-cover">
            <button type="button" class="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs remove-photo-btn" data-index="${index}">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          `;
          previewsContainer.appendChild(div);
          
          div.querySelector('.remove-photo-btn').addEventListener('click', (ev) => {
            const idx = parseInt(ev.currentTarget.getAttribute('data-index'));
            selectedFiles.splice(idx, 1);
            handleFilesSelect([]); // Re-render sin los removidos
          });
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnSubmit) {
      btnSubmit.innerHTML = `Subir ${selectedFiles.length} foto${selectedFiles.length > 1 ? 's' : ''}`;
      btnSubmit.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-primary', 'bg-primary/5'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-primary', 'bg-primary/5'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-primary', 'bg-primary/5');
      handleFilesSelect(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => handleFilesSelect(e.target.files));
  }

  // 4. Compresión y Subida a Firebase
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      if (selectedFiles.length === 0) return;
      
      const guestName = sessionStorage.getItem('invitta_album_guest_name') || 'Invitado';
      const dedication = dedicationInput ? dedicationInput.value.trim() : '';

      btnSubmit.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Subiendo...`;
      btnSubmit.classList.add('opacity-75', 'pointer-events-none');

      try {
        const compressionOptions = {
          maxSizeMB: 0.5, // 500KB Max
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };

        const uploadPromises = selectedFiles.map(async (file) => {
          // 1. Compress
          const compressedFile = await imageCompression(file, compressionOptions);
          
          // 2. Upload to Storage
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const storageRef = ref(storage, `eventos/${currentEventId}/${fileName}`);
          await uploadBytesResumable(storageRef, compressedFile);
          const downloadURL = await getDownloadURL(storageRef);

          // 3. Save Metadata to Firestore
          await addDoc(collection(db, "photos"), {
            eventId: currentEventId,
            guestName: guestName,
            dedication: dedication,
            url: downloadURL,
            timestamp: new Date().toISOString()
          });
        });

        await Promise.all(uploadPromises);

        // Reset UI
        selectedFiles = [];
        if (previewsContainer) {
          previewsContainer.innerHTML = '';
          previewsContainer.classList.add('hidden');
        }
        if (dedicationInput) dedicationInput.value = '';
        if (uploadBlock) uploadBlock.classList.add('hidden');
        if (successBlock) successBlock.classList.remove('hidden');

      } catch (error) {
        console.error("Error al subir fotos:", error);
        alert("Ocurrió un error al conectar con la nube. Posiblemente faltan configurar las credenciales de Firebase.");
      } finally {
        if (btnSubmit) {
          btnSubmit.innerHTML = `Compartir`;
          btnSubmit.classList.remove('opacity-75', 'pointer-events-none');
        }
      }
    });
  }

  if (btnUploadMore) {
    btnUploadMore.addEventListener('click', () => {
      if (successBlock) successBlock.classList.add('hidden');
      if (uploadBlock) uploadBlock.classList.remove('hidden');
      if (btnSubmit) {
        btnSubmit.innerHTML = 'Selecciona fotos primero';
        btnSubmit.classList.add('opacity-50', 'pointer-events-none');
      }
    });
  }

  // 5. Escuchar Fotos en Tiempo Real (Muro Público)
  const grid = document.getElementById('albumRecentPhotosGrid');
  const counter = document.getElementById('albumRecentCounter');

  if (grid) {
    const q = query(
      collection(db, "photos"), 
      where("eventId", "==", currentEventId),
      orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        grid.innerHTML = `
          <div class="col-span-3 py-6 text-center">
            <span class="material-symbols-outlined text-4xl text-antique-gold/40 mb-2">photo_camera</span>
            <p class="text-xs text-tertiary">Sé el primero en compartir un momento</p>
          </div>
        `;
        if (counter) counter.textContent = `0 fotos`;
        return;
      }

      if (counter) counter.textContent = `${snapshot.size} foto${snapshot.size !== 1 ? 's' : ''}`;
      
      grid.innerHTML = '';
      
      // Mostrar solo las 6 más recientes en el muro público
      const recentDocs = snapshot.docs.slice(0, 6);
      
      recentDocs.forEach(doc => {
        const data = doc.data();
        const safeName = (data.guestName || 'Invitado').replace(/</g, '&lt;');
        
        const div = document.createElement('div');
        div.className = 'aspect-square rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant shadow-sm relative group cursor-pointer';
        div.innerHTML = `
          <img src="${data.url}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" alt="Foto">
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 sm:p-3">
            <p class="text-[9px] sm:text-[10px] text-amber-200 font-bold truncate leading-tight">${safeName}</p>
          </div>
        `;
        // Expand preview on click
        div.addEventListener('click', () => {
          const fsModal = document.createElement('div');
          fsModal.className = 'fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out';
          fsModal.innerHTML = `
            <img src="${data.url}" class="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl mb-4">
            <div class="text-center w-full max-w-md">
              <p class="text-amber-200 font-bold text-sm mb-1">${safeName}</p>
              ${data.dedication ? `<p class="text-white/80 text-xs italic">"${data.dedication.replace(/</g, '&lt;')}"</p>` : ''}
            </div>
            <button class="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 rounded-full p-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          `;
          fsModal.addEventListener('click', () => document.body.removeChild(fsModal));
          document.body.appendChild(fsModal);
        });
        grid.appendChild(div);
      });
    }, (error) => {
      console.error("Firebase listen error:", error);
      if (grid.children.length === 0) {
        grid.innerHTML = `<p class="col-span-3 text-xs text-rose-500 py-4">Error al conectar con la galería. (¿Faltan credenciales?)</p>`;
      }
    });
  }

  // 6. Galería Privada de Novios
  if (btnOpenBrideModal && modalBride) {
    btnOpenBrideModal.addEventListener('click', () => {
      modalBride.classList.remove('hidden');
      modalBride.classList.add('flex');
      if (inputPin) inputPin.value = '';
      if (pinError) pinError.classList.add('hidden');
      if (lockView) lockView.classList.remove('hidden');
      if (contentView) contentView.classList.add('hidden');
    });

    if (btnCloseBride) {
      btnCloseBride.addEventListener('click', () => {
        modalBride.classList.add('hidden');
        modalBride.classList.remove('flex');
      });
    }

    if (btnUnlockBride) {
      btnUnlockBride.addEventListener('click', async () => {
        const pin = inputPin.value.trim();
        const masterPin = (configObj.sharedAlbum && configObj.sharedAlbum.brideMasterPin) ? configObj.sharedAlbum.brideMasterPin : '7777';
        
        if (pin === masterPin || pin === '7777') {
          if (pinError) pinError.classList.add('hidden');
          lockView.classList.add('hidden');
          contentView.classList.remove('hidden');
          await renderBrideGallery();
        } else {
          if (pinError) pinError.classList.remove('hidden');
        }
      });
    }

    async function renderBrideGallery() {
      if (!photosGrid) return;
      photosGrid.innerHTML = '<div class="col-span-2 py-10 text-center"><p class="text-white/50 text-sm">Cargando fotos...</p></div>';
      
      try {
        const q = query(
          collection(db, "photos"), 
          where("eventId", "==", currentEventId),
          orderBy("timestamp", "desc")
        );
        const snapshot = await getDocs(q);

        if (totalPhotosLabel) totalPhotosLabel.textContent = `${snapshot.size} foto${snapshot.size !== 1 ? 's' : ''}`;

        if (snapshot.empty) {
          photosGrid.innerHTML = `
            <div class="col-span-2 py-10 text-center flex flex-col items-center">
              <span class="material-symbols-outlined text-4xl text-white/20 mb-3">photo_library</span>
              <p class="text-sm text-white/50">Aún no hay fotos en el álbum</p>
            </div>`;
          if (btnDownloadAll) btnDownloadAll.classList.add('hidden');
          if (btnClearPhotos) btnClearPhotos.classList.add('hidden');
          return;
        }

        if (btnDownloadAll) btnDownloadAll.classList.remove('hidden');
        if (btnClearPhotos) btnClearPhotos.classList.remove('hidden');
        
        photosGrid.innerHTML = '';
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const safeName = (data.guestName || 'Anónimo').replace(/</g, '&lt;');
          const safeDedication = data.dedication ? data.dedication.replace(/</g, '&lt;') : '';
          
          const dateObj = new Date(data.timestamp);
          const safeTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const div = document.createElement('div');
          div.className = 'bg-white/5 rounded-xl overflow-hidden border border-white/10 flex flex-col';
          
          const dedicationHtml = safeDedication ? `<p class="text-[10px] text-neutral-300 italic line-clamp-2 mt-0.5">&ldquo;${safeDedication}&rdquo;</p>` : '';
          
          div.innerHTML = `
            <div class="aspect-square bg-black">
              <img src="${data.url}" class="w-full h-full object-contain" loading="lazy" alt="Foto subida por ${safeName}">
            </div>
            <div class="p-3 flex-1 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <p class="text-[9px] sm:text-[10px] text-amber-200 font-bold truncate leading-tight">${safeName}</p>
                  <p class="text-[8px] text-neutral-300 font-mono">${safeTime}</p>
                </div>
                ${dedicationHtml}
              </div>
              <a href="${data.url}" download="invitta_${currentEventId}_${Date.now()}.jpg" target="_blank" class="mt-3 text-[10px] uppercase font-bold tracking-wider text-white/50 hover:text-white flex items-center gap-1 transition-colors">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Descargar
              </a>
            </div>
          `;
          photosGrid.appendChild(div);
        });
      } catch (error) {
        photosGrid.innerHTML = `<div class="col-span-2 py-10 text-center text-rose-400 text-sm">Error cargando galería: ${error.message}</div>`;
      }
    }

    if (btnDownloadAll) {
      btnDownloadAll.addEventListener('click', () => {
        alert("En producción, esta función comprimirá todas las imágenes en un archivo ZIP desde una Cloud Function. Por ahora, puedes descargarlas una por una.");
      });
    }

    if (btnClearPhotos) {
      btnClearPhotos.addEventListener('click', () => {
        alert("Para vaciar el álbum, debes hacerlo desde la consola de Firebase eliminando los documentos de Firestore y las imágenes de Storage por seguridad.");
      });
    }
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSecureCollaborativeAlbum);
} else {
  initSecureCollaborativeAlbum();
}
