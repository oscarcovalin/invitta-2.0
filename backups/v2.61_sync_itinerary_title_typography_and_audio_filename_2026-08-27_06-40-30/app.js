/**
 * Lógica principal del Dashboard Generador de Invitaciones de Lujo (XV Años & Bodas)
 * Versión 3.2: Soporte Especializado para Bodas (Padres de la Novia y Padres del Novio)
 */

let currentConfig = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
let currentThemeName = "vino";
let customTheme = JSON.parse(JSON.stringify(TemplateEngine.defaultThemes.vino));
let debounceTimer = null;
let currentVipUrl = "";

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
  setupAccordion();
  setupDeviceSwitcher();
  setupThemePicker();
  setupEventTypeSwitcher();
  setupTypographyControls();
  setupBackgroundControls();
  setupIllustrationControls();
  setupRsvpTitleControls();
  setupSectionToggles();
  setupStoryControls();
  setupDressCodeControls();
  setupInstagramControls();
  setupDynamicLists();
  setupFileUploads();
  setupHeaderActions();
  setupInputListeners();

  populateForm();
  updatePreview(true);
});

// ==================== ACCORDION ====================
function setupAccordion() {
  const headers = document.querySelectorAll('.accordion-header');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');
      item.classList.toggle('active', !isActive);
    });
  });
}

// ==================== EVENT TYPE SWITCHER ====================
function setupEventTypeSwitcher() {
  const selectType = document.getElementById('selectEventType');
  const groupSingle = document.getElementById('groupSingleName');
  const groupWedding = document.getElementById('groupWeddingNames');
  const parentsXv = document.getElementById('parentsXvFields');
  const parentsBoda = document.getElementById('parentsBodaFields');
  const lblGodparents = document.getElementById('lblGodparentsHeader');
  const lblCourt = document.getElementById('lblCourtHeader');

  selectType.addEventListener('change', (e) => {
    const isWedding = e.target.value === 'boda';
    currentConfig.eventType = e.target.value;

    groupSingle.style.display = isWedding ? 'none' : 'block';
    groupWedding.style.display = isWedding ? 'flex' : 'none';
    parentsXv.style.display = isWedding ? 'none' : 'block';
    parentsBoda.style.display = isWedding ? 'block' : 'none';

    if (isWedding) {
      lblGodparents.textContent = '✨ Padrinos de Velación';
      lblCourt.textContent = 'Damas de Honor & Best Men';
      if (!currentConfig.eyebrow || currentConfig.eyebrow === 'Mis XV años') {
        currentConfig.eyebrow = 'Nuestra Boda';
        document.getElementById('inputEyebrow').value = 'Nuestra Boda';
      }
      if (!currentConfig.blessingIntro || currentConfig.blessingIntro.includes('mis padres')) {
        currentConfig.blessingIntro = 'Con la bendición de Dios y el amor de nuestros padres, unimos nuestras vidas';
        document.getElementById('inputBlessing').value = currentConfig.blessingIntro;
      }
    } else {
      lblGodparents.textContent = '✨ Mis Padrinos';
      lblCourt.textContent = 'Mis Chambelanes';
      if (!currentConfig.eyebrow || currentConfig.eyebrow === 'Nuestra Boda') {
        currentConfig.eyebrow = 'Mis XV años';
        document.getElementById('inputEyebrow').value = 'Mis XV años';
      }
      // Adaptar itinerario para XV Años si viene de Boda (incorporar Coreografías)
      if (currentConfig.itinerary && Array.isArray(currentConfig.itinerary)) {
        let hasChoreo = currentConfig.itinerary.some(s => s.icon === 'choreography' || (s.label && s.label.toLowerCase().includes('coreograf')));
        currentConfig.itinerary.forEach(s => {
          if (s.icon === 'rings') {
            s.icon = 'choreography';
            s.label = 'Coreografías & Baile Sorpresa';
          }
        });
        if (!hasChoreo) {
          // Añadir paso de Coreografía antes o después del Vals
          const danceIdx = currentConfig.itinerary.findIndex(s => s.icon === 'dance');
          if (danceIdx !== -1) {
            currentConfig.itinerary.splice(danceIdx + 1, 0, {
              icon: 'choreography',
              label: 'Coreografías & Baile Sorpresa',
              time: '10:15 p.m.'
            });
          }
        }
        renderItineraryInputs();
      }
    }

    schedulePreviewUpdate();
  });
}

// ==================== DEVICE SWITCHER ====================
function setupDeviceSwitcher() {
  const frame = document.getElementById('deviceFrame');
  const buttons = document.querySelectorAll('.device-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const device = btn.dataset.device;
      frame.className = `device-frame ${device}`;
    });
  });

  document.getElementById('btnRefreshPreview').addEventListener('click', () => {
    updatePreview(true);
    showToast('Vista previa actualizada');
  });
}

// ==================== THEME PICKER ====================
function setupThemePicker() {
  const cards = document.querySelectorAll('.theme-card');
  const customWrapper = document.getElementById('customColorsWrapper');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      currentThemeName = card.dataset.theme;

      if (currentThemeName === 'custom') {
        customWrapper.style.display = 'block';
      } else {
        customWrapper.style.display = 'none';
      }
      schedulePreviewUpdate();
    });
  });

  const colorMap = {
    colWine900: 'wine-900',
    colWine700: 'wine-700',
    colGold500: 'gold-500',
    colCream: 'cream'
  };

  Object.entries(colorMap).forEach(([id, varName]) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', (e) => {
        customTheme[varName] = e.target.value;
        if (currentThemeName === 'custom') {
          schedulePreviewUpdate();
        }
      });
    }
  });
}

// ==================== RSVP TITLE & DEADLINE CONTROLS ====================
function setupRsvpTitleControls() {
  const selectTitle = document.getElementById('selectRsvpTitle');
  const customTitle = document.getElementById('inputCustomRsvpTitle');
  if (selectTitle) {
    selectTitle.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        if (customTitle) customTitle.style.display = 'block';
        currentConfig.rsvpTitle = (customTitle && customTitle.value) ? customTitle.value : 'Confirmación de Asistencia';
      } else {
        if (customTitle) customTitle.style.display = 'none';
        currentConfig.rsvpTitle = val;
      }
      if (!currentConfig.rsvp) currentConfig.rsvp = {};
      currentConfig.rsvp.title = currentConfig.rsvpTitle;
      schedulePreviewUpdate();
    });
  }

  if (customTitle) {
    customTitle.addEventListener('input', (e) => {
      currentConfig.rsvpTitle = e.target.value;
      if (!currentConfig.rsvp) currentConfig.rsvp = {};
      currentConfig.rsvp.title = e.target.value;
      schedulePreviewUpdate();
    });
  }

  // RSVP Deadline Day & Month
  const selectDay = document.getElementById('selectRsvpDay');
  const selectMonth = document.getElementById('selectRsvpMonth');
  const previewPhrase = document.getElementById('previewRsvpDeadlinePhrase');
  const inputDeadline = document.getElementById('inputRsvpDeadline');

  if (selectDay && selectDay.options.length === 0) {
    selectDay.innerHTML = '';
    for (let i = 1; i <= 31; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i}`;
      if (i === 20) opt.selected = true;
      selectDay.appendChild(opt);
    }
  }

  const updateDeadlinePhrase = () => {
    const day = selectDay ? selectDay.value : '20';
    const month = selectMonth ? selectMonth.value : 'Febrero';
    const phrase = `Por favor, haznos saber si podrás acompañarnos antes del ${day} de ${month}.`;
    if (previewPhrase) previewPhrase.textContent = phrase;
    if (inputDeadline) inputDeadline.value = phrase;
    currentConfig.rsvpDeadlineLabel = phrase;
    schedulePreviewUpdate();
  };

  if (selectDay) selectDay.addEventListener('change', updateDeadlinePhrase);
  if (selectMonth) selectMonth.addEventListener('change', updateDeadlinePhrase);

  // Multi-Host WhatsApp & Webhook listeners
  const inH1 = document.getElementById('inputHostPhone1');
  const inH2 = document.getElementById('inputHostPhone2');
  const inH3 = document.getElementById('inputHostPhone3');
  const inWb = document.getElementById('inputRsvpWebhook');

  const updateHostConfig = () => {
    if (!currentConfig.whatsappHosts) {
      currentConfig.whatsappHosts = [
        { label: "Anfitrión Principal / Novia", phone: "" },
        { label: "Segundo Anfitrión / Novio", phone: "" },
        { label: "Coordinador / Planner", phone: "" }
      ];
    }
    if (inH1) {
      currentConfig.whatsappHosts[0] = { label: "Anfitrión Principal / Novia", phone: inH1.value.trim() };
      currentConfig.whatsappNumber = inH1.value.trim();
    }
    if (inH2) {
      currentConfig.whatsappHosts[1] = { label: "Segundo Anfitrión / Novio", phone: inH2.value.trim() };
    }
    if (inH3) {
      currentConfig.whatsappHosts[2] = { label: "Coordinador / Planner", phone: inH3.value.trim() };
    }
    if (inWb) {
      currentConfig.rsvpWebhookUrl = inWb.value.trim();
    }
    schedulePreviewUpdate();
  };

  if (inH1) inH1.addEventListener('input', updateHostConfig);
  if (inH2) inH2.addEventListener('input', updateHostConfig);
  if (inH3) inH3.addEventListener('input', updateHostConfig);
  if (inWb) inWb.addEventListener('input', updateHostConfig);
}

// ==================== SECTION TOGGLES ====================
function setupSectionToggles() {
  const toggles = [
    {
      chkId: 'checkStoryEnabled',
      containerId: 'storyFields',
      set: (val) => {
        if (!currentConfig.story) currentConfig.story = {};
        currentConfig.story.enabled = val;
      }
    },
    {
      chkId: 'checkCountdownEnabled',
      containerId: 'countdownFields',
      set: (val) => {
        if (!currentConfig.countdown) currentConfig.countdown = {};
        currentConfig.countdown.enabled = val;
        currentConfig.countdownEnabled = val;
      }
    },
    {
      chkId: 'checkFamilyEnabled',
      containerId: 'familyFields',
      set: (val) => {
        if (!currentConfig.family) currentConfig.family = {};
        currentConfig.family.enabled = val;
        currentConfig.familyEnabled = val;
      }
    },
    {
      chkId: 'checkLocationsEnabled',
      containerId: 'locationsFields',
      set: (val) => {
        if (!currentConfig.locations) currentConfig.locations = {};
        currentConfig.locations.enabled = val;
        currentConfig.locationsEnabled = val;
      }
    },
    {
      chkId: 'checkStardustEnabled',
      containerId: 'stardustFields',
      set: (val) => {
        if (!currentConfig.stardust) currentConfig.stardust = {};
        currentConfig.stardust.enabled = val;
      }
    },
    {
      chkId: 'checkDressCodeEnabled',
      containerId: 'dressCodeFields',
      set: (val) => {
        if (!currentConfig.dressCode) currentConfig.dressCode = {};
        currentConfig.dressCode.enabled = val;
      }
    },
    {
      chkId: 'checkGalleryEnabled',
      containerId: 'galleryFields',
      set: (val) => {
        if (!currentConfig.photos) currentConfig.photos = {};
        currentConfig.photos.galleryEnabled = val;
        if (!currentConfig.gallery) currentConfig.gallery = {};
        currentConfig.gallery.enabled = val;
      }
    },
    {
      chkId: 'checkGiftEnabled',
      containerId: 'giftRegistryFields',
      set: (val) => {
        if (!currentConfig.giftRegistry) currentConfig.giftRegistry = {};
        currentConfig.giftRegistry.enabled = val;
      }
    },
    {
      chkId: 'checkItineraryEnabled',
      containerId: 'itineraryFields',
      set: (val) => {
        currentConfig.itineraryEnabled = val;
        if (currentConfig.itinerary && typeof currentConfig.itinerary === 'object' && !Array.isArray(currentConfig.itinerary)) {
          currentConfig.itinerary.enabled = val;
        }
      }
    },
    {
      chkId: 'checkSharedAlbumEnabled',
      containerId: 'sharedAlbumFields',
      set: (val) => {
        if (!currentConfig.sharedAlbum) currentConfig.sharedAlbum = {};
        currentConfig.sharedAlbum.enabled = val;
      }
    },
    {
      chkId: 'checkInstagramEnabled',
      containerId: 'instagramFields',
      set: (val) => {
        if (!currentConfig.instagram) currentConfig.instagram = {};
        currentConfig.instagram.enabled = val;
      }
    },
    {
      chkId: 'checkRsvpEnabled',
      containerId: 'rsvpFields',
      set: (val) => {
        if (!currentConfig.rsvp) currentConfig.rsvp = {};
        currentConfig.rsvp.enabled = val;
        currentConfig.rsvpEnabled = val;
      }
    },
    {
      chkId: 'checkMusicEnabled',
      containerId: 'musicFields',
      set: (val) => {
        if (!currentConfig.music) currentConfig.music = {};
        currentConfig.music.enabled = val;
      }
    },
    {
      chkId: 'checkVendorCardEnabled',
      containerId: 'vendorCardFields',
      set: (val) => {
        if (!currentConfig.vendorCard) currentConfig.vendorCard = {};
        currentConfig.vendorCard.enabled = val;
      }
    }
  ];

  toggles.forEach(t => {
    const chk = document.getElementById(t.chkId);
    const container = document.getElementById(t.containerId);
    if (chk) {
      chk.addEventListener('change', (e) => {
        t.set(e.target.checked);
        if (container) container.style.display = e.target.checked ? 'block' : 'none';
        schedulePreviewUpdate();
      });
    }
  });
}

// ==================== STORY CONTROLS ====================
function setupStoryControls() {
  const photoInput = document.getElementById('inputStoryPhoto');
  const photoFile = document.getElementById('fileStoryPhoto');

  photoFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        photoInput.value = re.target.result;
        if (!currentConfig.story) currentConfig.story = {};
        currentConfig.story.photo = re.target.result;
        schedulePreviewUpdate();
        showToast('Foto de semblanza cargada');
      };
      reader.readAsDataURL(file);
    }
  });
}

// ==================== DRESS CODE & COLOR PALETTE ====================
function setupDressCodeControls() {
  const checkColors = document.getElementById('checkDressColors');
  const paletteFields = document.getElementById('dressPaletteFields');
  const btnAddColor = document.getElementById('btnAddDressColor');

  checkColors.addEventListener('change', (e) => {
    if (!currentConfig.dressCode) currentConfig.dressCode = {};
    currentConfig.dressCode.colorsEnabled = e.target.checked;
    paletteFields.style.display = e.target.checked ? 'block' : 'none';
    schedulePreviewUpdate();
  });

  btnAddColor.addEventListener('click', () => {
    if (!currentConfig.dressCode) currentConfig.dressCode = {};
    if (!currentConfig.dressCode.colorPalette) currentConfig.dressCode.colorPalette = [];
    currentConfig.dressCode.colorPalette.push({ name: 'Nuevo Color', hex: '#c59d60' });
    renderDressColorsInputs();
    schedulePreviewUpdate();
  });
}

function renderDressColorsInputs() {
  const container = document.getElementById('dressColorsList');
  container.innerHTML = '';
  const colors = (currentConfig.dressCode && currentConfig.dressCode.colorPalette) || [];
  colors.forEach((color, index) => {
    const row = document.createElement('div');
    row.className = 'dynamic-item';
    row.innerHTML = `
      <input type="color" class="color-picker" value="${color.hex || '#c59d60'}" style="width:40px; height:34px; border-radius:6px; border:none; cursor:pointer; background:none;">
      <input type="text" class="color-name" value="${color.name || ''}" placeholder="Nombre del color" style="flex:1;">
      <button type="button" class="btn-icon-danger" title="Eliminar color">&times;</button>
    `;

    row.querySelector('.color-picker').addEventListener('input', (e) => {
      color.hex = e.target.value;
      schedulePreviewUpdate();
    });
    row.querySelector('.color-name').addEventListener('input', (e) => {
      color.name = e.target.value;
      schedulePreviewUpdate();
    });
    row.querySelector('.btn-icon-danger').addEventListener('click', () => {
      currentConfig.dressCode.colorPalette.splice(index, 1);
      renderDressColorsInputs();
      schedulePreviewUpdate();
    });

    container.appendChild(row);
  });
}

function renderHotelsInputs() {
  const container = document.getElementById('hotelsList');
  if (!container) return;
  container.innerHTML = '';
  const hotels = (currentConfig.lodging && currentConfig.lodging.hotels) || [];
  hotels.forEach((hotel, index) => {
    const card = document.createElement('div');
    card.className = 'panel-luxury-subcard';
    card.style.marginBottom = '14px';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(193,154,78,0.25); padding-bottom:6px;">
        <span style="font-weight:700; font-size:11px; color:var(--primary); text-transform:uppercase; letter-spacing:0.15em;">🏨 Opción ${index + 1}</span>
        <button type="button" class="btn-remove-hotel" title="Eliminar hotel" style="background:none; border:none; color:var(--error); font-size:16px; font-weight:bold; cursor:pointer; padding:2px 6px;">&times;</button>
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:11px;">Nombre del Hotel / Alojamiento</label>
        <input type="text" class="hotel-name" value="${hotel.name || ''}" placeholder="Ej. Hotel Quinta Real">
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:11px;">Dirección Completa</label>
        <input type="text" class="hotel-address" value="${hotel.address || ''}" placeholder="Ej. Av. Juárez 100, Col. Centro">
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:11px;">Ubicación en Google Maps (URL)</label>
        <input type="url" class="hotel-maps" value="${hotel.mapsUrl || ''}" placeholder="https://maps.google.com/?q=...">
      </div>
      <div class="form-row" style="margin-bottom:0;">
        <div class="form-group" style="margin-bottom:0;">
          <label style="font-size:11px;">Teléfono (Opcional)</label>
          <input type="tel" class="hotel-phone" value="${hotel.phone || ''}" placeholder="+52 55 1234 5678">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label style="font-size:11px;">Código Convenio (Opcional)</label>
          <input type="text" class="hotel-code" value="${hotel.code || ''}" placeholder="BODA2027">
        </div>
      </div>
    `;

    card.querySelector('.hotel-name').addEventListener('input', (e) => {
      hotel.name = e.target.value;
      schedulePreviewUpdate();
    });
    card.querySelector('.hotel-address').addEventListener('input', (e) => {
      hotel.address = e.target.value;
      schedulePreviewUpdate();
    });
    card.querySelector('.hotel-maps').addEventListener('input', (e) => {
      hotel.mapsUrl = e.target.value;
      schedulePreviewUpdate();
    });
    card.querySelector('.hotel-phone').addEventListener('input', (e) => {
      hotel.phone = e.target.value;
      schedulePreviewUpdate();
    });
    card.querySelector('.hotel-code').addEventListener('input', (e) => {
      hotel.code = e.target.value;
      schedulePreviewUpdate();
    });
    card.querySelector('.btn-remove-hotel').addEventListener('click', () => {
      currentConfig.lodging.hotels.splice(index, 1);
      renderHotelsInputs();
      schedulePreviewUpdate();
      showToast('Hotel sugerido eliminado');
    });

    container.appendChild(card);
  });
}

// ==================== INSTAGRAM CONTROLS ====================
function setupInstagramControls() {
  const checkInstagram = document.getElementById('checkInstagramEnabled');
  const fields = document.getElementById('instagramFields');

  checkInstagram.addEventListener('change', (e) => {
    if (!currentConfig.instagram) currentConfig.instagram = {};
    currentConfig.instagram.enabled = e.target.checked;
    fields.style.display = e.target.checked ? 'block' : 'none';
    schedulePreviewUpdate();
  });
}

// ==================== TYPOGRAPHY CONTROLS ====================
function setupTypographyControls() {
  const fontFields = [
    { 
      selectId: 'selectFontNames', 
      customId: 'inputCustomNames', 
      fileId: 'fileFontNames',
      badgeId: 'badgeCustomNamesFile',
      nameId: 'nameCustomNamesFile',
      clearId: 'btnClearNamesFile',
      key: 'namesFont', 
      customKey: 'customNames',
      fileKey: 'customNamesFile',
      fileNameKey: 'customNamesFileName'
    },
    { 
      selectId: 'selectFontScript', 
      customId: 'inputCustomScript', 
      fileId: 'fileFontScript',
      badgeId: 'badgeCustomScriptFile',
      nameId: 'nameCustomScriptFile',
      clearId: 'btnClearScriptFile',
      key: 'scriptFont', 
      customKey: 'customScript',
      fileKey: 'customScriptFile',
      fileNameKey: 'customScriptFileName'
    },
    { 
      selectId: 'selectFontDisplay', 
      customId: 'inputCustomDisplay', 
      fileId: 'fileFontDisplay',
      badgeId: 'badgeCustomDisplayFile',
      nameId: 'nameCustomDisplayFile',
      clearId: 'btnClearDisplayFile',
      key: 'displayFont', 
      customKey: 'customDisplay',
      fileKey: 'customDisplayFile',
      fileNameKey: 'customDisplayFileName'
    },
    { 
      selectId: 'selectFontBody', 
      customId: 'inputCustomBody', 
      fileId: 'fileFontBody',
      badgeId: 'badgeCustomBodyFile',
      nameId: 'nameCustomBodyFile',
      clearId: 'btnClearBodyFile',
      key: 'bodyFont', 
      customKey: 'customBody',
      fileKey: 'customBodyFile',
      fileNameKey: 'customBodyFileName'
    }
  ];

  if (!currentConfig.typography) currentConfig.typography = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.typography));

  fontFields.forEach(({ selectId, customId, fileId, badgeId, nameId, clearId, key, customKey, fileKey, fileNameKey }) => {
    const selectEl = document.getElementById(selectId);
    const customEl = document.getElementById(customId);
    const fileEl = document.getElementById(fileId);
    const badgeEl = document.getElementById(badgeId);
    const nameEl = document.getElementById(nameId);
    const clearEl = document.getElementById(clearId);

    selectEl.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      customEl.style.display = isCustom ? 'block' : 'none';
      if (!isCustom) {
        currentConfig.typography[key] = e.target.value;
        currentConfig.typography[customKey] = '';
        customEl.value = '';
      }
      schedulePreviewUpdate();
    });

    customEl.addEventListener('input', (e) => {
      currentConfig.typography[customKey] = e.target.value;
      schedulePreviewUpdate();
    });

    // Subida manual de archivo de fuente (.ttf, .otf, .woff, .woff2)
    if (fileEl) {
      fileEl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            currentConfig.typography[fileKey] = re.target.result;
            currentConfig.typography[fileNameKey] = file.name;
            badgeEl.style.display = 'flex';
            nameEl.textContent = file.name;
            schedulePreviewUpdate();
            showToast(`Fuente cargada: ${file.name}`);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Botón para quitar fuente manual cargada
    if (clearEl) {
      clearEl.addEventListener('click', () => {
        currentConfig.typography[fileKey] = '';
        currentConfig.typography[fileNameKey] = '';
        badgeEl.style.display = 'none';
        fileEl.value = '';
        schedulePreviewUpdate();
        showToast('Fuente manual eliminada, usando tipografía del sistema');
      });
    }
  });

  // 4. Efecto de Títulos (Metálico Foil vs Color Sólido)
  const selectTitleEffect = document.getElementById('selectTitleEffect');
  const wrapTitleMetallic = document.getElementById('wrapTitleMetallic');
  const wrapTitleSolid = document.getElementById('wrapTitleSolid');
  const selectTitleMetallicPreset = document.getElementById('selectTitleMetallicPreset');
  const inputCustomMetallicGradient = document.getElementById('inputCustomMetallicGradient');
  const inputTitleSolidColor = document.getElementById('inputTitleSolidColor');
  const inputTitleSolidColorHex = document.getElementById('inputTitleSolidColorHex');

  if (selectTitleEffect) {
    selectTitleEffect.addEventListener('change', (e) => {
      currentConfig.typography.titleEffect = e.target.value;
      const isMetallic = e.target.value === 'metallic';
      wrapTitleMetallic.style.display = isMetallic ? 'block' : 'none';
      wrapTitleSolid.style.display = isMetallic ? 'none' : 'block';
      schedulePreviewUpdate();
    });
  }

  if (selectTitleMetallicPreset) {
    selectTitleMetallicPreset.addEventListener('change', (e) => {
      currentConfig.typography.titleMetallicPreset = e.target.value;
      const isCustom = e.target.value === 'custom';
      inputCustomMetallicGradient.style.display = isCustom ? 'block' : 'none';
      schedulePreviewUpdate();
    });
  }

  if (inputCustomMetallicGradient) {
    inputCustomMetallicGradient.addEventListener('input', (e) => {
      currentConfig.typography.titleCustomMetallic = e.target.value;
      schedulePreviewUpdate();
    });
  }

  if (inputTitleSolidColor) {
    inputTitleSolidColor.addEventListener('input', (e) => {
      currentConfig.typography.titleSolidColor = e.target.value;
      if (inputTitleSolidColorHex) inputTitleSolidColorHex.value = e.target.value;
      schedulePreviewUpdate();
    });
  }

  if (inputTitleSolidColorHex) {
    inputTitleSolidColorHex.addEventListener('input', (e) => {
      currentConfig.typography.titleSolidColor = e.target.value;
      if (inputTitleSolidColor) inputTitleSolidColor.value = e.target.value;
      schedulePreviewUpdate();
    });
  }

  // 5. Escala y Tamaños Tipográficos
  const rangeScaleHero = document.getElementById('rangeScaleHero');
  const valScaleHero = document.getElementById('valScaleHero');
  const rangeScaleHeadings = document.getElementById('rangeScaleHeadings');
  const valScaleHeadings = document.getElementById('valScaleHeadings');
  const rangeScaleBody = document.getElementById('rangeScaleBody');
  const valScaleBody = document.getElementById('valScaleBody');
  const btnResetFontScales = document.getElementById('btnResetFontScales');

  const updateScaleDisplay = () => {
    if (rangeScaleHero && valScaleHero) valScaleHero.textContent = `${Math.round(parseFloat(rangeScaleHero.value) * 100)}%`;
    if (rangeScaleHeadings && valScaleHeadings) valScaleHeadings.textContent = `${Math.round(parseFloat(rangeScaleHeadings.value) * 100)}%`;
    if (rangeScaleBody && valScaleBody) valScaleBody.textContent = `${Math.round(parseFloat(rangeScaleBody.value) * 100)}%`;
  };

  const injectLiveScale = (varName, value) => {
    const iframe = document.getElementById('previewFrame');
    if (iframe && iframe.contentDocument && iframe.contentDocument.documentElement) {
      iframe.contentDocument.documentElement.style.setProperty(varName, String(value));
    }
  };

  if (rangeScaleHero) {
    rangeScaleHero.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      currentConfig.typography.scaleHero = val;
      updateScaleDisplay();
      injectLiveScale('--scale-hero', val);
      schedulePreviewUpdate();
    });
  }

  if (rangeScaleHeadings) {
    rangeScaleHeadings.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      currentConfig.typography.scaleHeadings = val;
      updateScaleDisplay();
      injectLiveScale('--scale-headings', val);
      schedulePreviewUpdate();
    });
  }

  if (rangeScaleBody) {
    rangeScaleBody.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      currentConfig.typography.scaleBody = val;
      updateScaleDisplay();
      injectLiveScale('--scale-body', val);
      schedulePreviewUpdate();
    });
  }

  // Presets Rápidos
  document.querySelectorAll('.btn-font-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = parseFloat(btn.dataset.hero || '1.0');
      const hd = parseFloat(btn.dataset.headings || '1.0');
      const b = parseFloat(btn.dataset.body || '1.0');
      currentConfig.typography.scaleHero = h;
      currentConfig.typography.scaleHeadings = hd;
      currentConfig.typography.scaleBody = b;
      if (rangeScaleHero) rangeScaleHero.value = String(h);
      if (rangeScaleHeadings) rangeScaleHeadings.value = String(hd);
      if (rangeScaleBody) rangeScaleBody.value = String(b);
      updateScaleDisplay();
      injectLiveScale('--scale-hero', h);
      injectLiveScale('--scale-headings', hd);
      injectLiveScale('--scale-body', b);
      schedulePreviewUpdate();
    });
  });

  if (btnResetFontScales) {
    btnResetFontScales.addEventListener('click', () => {
      currentConfig.typography.scaleHero = 1.0;
      currentConfig.typography.scaleHeadings = 1.0;
      currentConfig.typography.scaleBody = 1.0;
      if (rangeScaleHero) rangeScaleHero.value = '1.0';
      if (rangeScaleHeadings) rangeScaleHeadings.value = '1.0';
      if (rangeScaleBody) rangeScaleBody.value = '1.0';
      updateScaleDisplay();
      injectLiveScale('--scale-hero', 1.0);
      injectLiveScale('--scale-headings', 1.0);
      injectLiveScale('--scale-body', 1.0);
      schedulePreviewUpdate();
    });
  }
}

// ==================== BACKGROUND CONTROLS ====================
function setupBackgroundControls() {
  if (!currentConfig.sectionBackgrounds) currentConfig.sectionBackgrounds = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.sectionBackgrounds));

  const bgMap = [
    { id: 'bgWelcome', path: 'sectionBackgrounds.welcomeBg' },
    { id: 'bgFamily', path: 'sectionBackgrounds.familyBg' },
    { id: 'bgStory', path: 'sectionBackgrounds.storyBg' },
    { id: 'bgDetails', path: 'sectionBackgrounds.detailsBg' },
    { id: 'bgDressCode', path: 'sectionBackgrounds.dressCodeBg' },
    { id: 'bgGiftRegistry', path: 'sectionBackgrounds.giftRegistryBg' },
    { id: 'bgInstagram', path: 'sectionBackgrounds.instagramBg' },
    { id: 'bgRsvp', path: 'sectionBackgrounds.rsvpBg' },
    { id: 'bgFooter', path: 'sectionBackgrounds.footerBg' }
  ];

  bgMap.forEach(({ id, path }) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', (e) => {
        setObjectPath(currentConfig, path, e.target.value);
        schedulePreviewUpdate();
      });
    }
  });
}

// ==================== FORM POPULATION & BINDING ====================
function populateForm() {
  const isWedding = currentConfig.eventType === 'boda';
  document.getElementById('selectEventType').value = currentConfig.eventType || 'xv';
  
  document.getElementById('groupSingleName').style.display = isWedding ? 'none' : 'block';
  document.getElementById('groupWeddingNames').style.display = isWedding ? 'block' : 'none';
  document.getElementById('parentsXvFields').style.display = isWedding ? 'none' : 'block';
  document.getElementById('parentsBodaFields').style.display = isWedding ? 'block' : 'none';

  document.getElementById('inputName').value = currentConfig.name || '';
  document.getElementById('inputBrideName').value = currentConfig.brideName || '';
  document.getElementById('inputGroomName').value = currentConfig.groomName || '';

  // Conector entre Nombres (Boda)
  const connector = currentConfig.nameConnector || '&';
  const selConn = document.getElementById('selectNameConnector');
  const inCustomConn = document.getElementById('inputCustomNameConnector');
  if (selConn) {
    if (['&', '+', 'y'].includes(connector)) {
      selConn.value = connector;
      if (inCustomConn) {
        inCustomConn.value = '';
        inCustomConn.style.display = 'none';
      }
    } else {
      selConn.value = 'custom';
      if (inCustomConn) {
        inCustomConn.value = connector;
        inCustomConn.style.display = 'block';
      }
    }
  }

  document.getElementById('inputMonogram').value = currentConfig.monogram || '';
  document.getElementById('inputEyebrow').value = currentConfig.eyebrow || '';
  document.getElementById('inputWelcome').value = currentConfig.welcomeMessage || '';
  document.getElementById('inputQuote').value = currentConfig.quote || '';
  const inFooterClosing = document.getElementById('inputFooterClosing');
  if (inFooterClosing) inFooterClosing.value = currentConfig.footerClosing !== undefined ? currentConfig.footerClosing : 'Con amor,';
  document.getElementById('inputFooterText').value = currentConfig.footerText || '';

  // Sincronización de todas las casillas de activación de sección
  const sectionSyncList = [
    { chkId: 'checkStoryEnabled', containerId: 'storyFields', get: () => currentConfig.story ? currentConfig.story.enabled !== false : true },
    { chkId: 'checkCountdownEnabled', containerId: 'countdownFields', get: () => (currentConfig.countdown ? currentConfig.countdown.enabled !== false : true) && currentConfig.countdownEnabled !== false },
    { chkId: 'checkFamilyEnabled', containerId: 'familyFields', get: () => (currentConfig.family ? currentConfig.family.enabled !== false : true) && currentConfig.familyEnabled !== false },
    { chkId: 'checkLocationsEnabled', containerId: 'locationsFields', get: () => (currentConfig.locations ? currentConfig.locations.enabled !== false : true) && currentConfig.locationsEnabled !== false },
    { chkId: 'checkStardustEnabled', containerId: 'stardustFields', get: () => currentConfig.stardust ? currentConfig.stardust.enabled !== false : true },
    { chkId: 'checkLodgingEnabled', containerId: 'lodgingFields', get: () => currentConfig.lodging ? currentConfig.lodging.enabled !== false : true },
    { chkId: 'checkDressCodeEnabled', containerId: 'dressCodeFields', get: () => currentConfig.dressCode ? currentConfig.dressCode.enabled !== false : true },
    { chkId: 'checkGalleryEnabled', containerId: 'galleryFields', get: () => (currentConfig.photos ? currentConfig.photos.galleryEnabled !== false : true) && (currentConfig.gallery ? currentConfig.gallery.enabled !== false : true) },
    { chkId: 'checkGiftEnabled', containerId: 'giftRegistryFields', get: () => currentConfig.giftRegistry ? currentConfig.giftRegistry.enabled !== false : true },
    { chkId: 'checkItineraryEnabled', containerId: 'itineraryFields', get: () => (currentConfig.itineraryEnabled !== false) && (currentConfig.itinerary ? currentConfig.itinerary.enabled !== false : true) },
    { chkId: 'checkSharedAlbumEnabled', containerId: 'sharedAlbumFields', get: () => currentConfig.sharedAlbum ? currentConfig.sharedAlbum.enabled !== false : true },
    { chkId: 'checkInstagramEnabled', containerId: 'instagramFields', get: () => currentConfig.instagram ? currentConfig.instagram.enabled !== false : true },
    { chkId: 'checkRsvpEnabled', containerId: 'rsvpFields', get: () => (currentConfig.rsvp ? currentConfig.rsvp.enabled !== false : true) && currentConfig.rsvpEnabled !== false },
    { chkId: 'checkMusicEnabled', containerId: 'musicFields', get: () => currentConfig.music ? currentConfig.music.enabled !== false : true },
    { chkId: 'checkVendorCardEnabled', containerId: 'vendorCardFields', get: () => currentConfig.vendorCard ? currentConfig.vendorCard.enabled !== false : true }
  ];

  sectionSyncList.forEach(t => {
    const chk = document.getElementById(t.chkId);
    const container = document.getElementById(t.containerId);
    const isEn = t.get();
    if (chk) chk.checked = isEn;
    if (container) container.style.display = isEn ? 'block' : 'none';
  });

  // Historia
  const story = currentConfig.story || {};
  document.getElementById('inputStoryTitle').value = story.title || '';
  document.getElementById('inputStorySubtitle').value = story.subtitle || '';
  document.getElementById('inputStoryText').value = story.text || '';
  document.getElementById('inputStoryPhoto').value = story.photo || '';

  // Hospedaje
  const lodging = currentConfig.lodging || {};
  const inLodgingTitle = document.getElementById('inputLodgingTitle');
  const inLodgingSub = document.getElementById('inputLodgingSubtitle');
  const inLodgingDesc = document.getElementById('inputLodgingDesc');
  if (inLodgingTitle) inLodgingTitle.value = lodging.title || 'Sugerencias de Hospedaje';
  if (inLodgingSub) inLodgingSub.value = lodging.subtitle || 'Para tu comodidad';
  if (inLodgingDesc) inLodgingDesc.value = lodging.description || '';
  renderHotelsInputs();

  // Instagram
  const ig = currentConfig.instagram || {};
  document.getElementById('inputInstagramHashtag').value = ig.hashtag || '';
  document.getElementById('inputInstagramText').value = ig.text || '';

  // Dress Code
  const dress = currentConfig.dressCode || {};
  document.getElementById('inputDressTitle').value = dress.title || '';
  document.getElementById('inputDressDesc').value = dress.description || '';
  document.getElementById('checkDressColors').checked = dress.colorsEnabled !== false;
  document.getElementById('dressPaletteFields').style.display = dress.colorsEnabled !== false ? 'block' : 'none';
  document.getElementById('inputReservedColors').value = dress.reservedColorsNote || '';
  renderDressColorsInputs();

  // Tipografías
  const typo = currentConfig.typography || TemplateEngine.defaultConfig.typography;
  
  // 0. Names Font (Portada & Firma de los Novios)
  const selectNames = document.getElementById('selectFontNames');
  const customNames = document.getElementById('inputCustomNames');
  const badgeNames = document.getElementById('badgeCustomNamesFile');
  const nameNames = document.getElementById('nameCustomNamesFile');
  if (selectNames) {
    if (typo.customNamesFile && typo.customNamesFileName) {
      if (badgeNames) badgeNames.style.display = 'flex';
      if (nameNames) nameNames.textContent = typo.customNamesFileName;
    } else {
      if (badgeNames) badgeNames.style.display = 'none';
    }
    if (typo.customNames) {
      selectNames.value = 'custom';
      if (customNames) {
        customNames.value = typo.customNames;
        customNames.style.display = 'block';
      }
    } else {
      selectNames.value = typo.namesFont || 'Cormorant Garamond';
      if (customNames) customNames.style.display = 'none';
    }
  }

  // 1. Script Font
  const selectScript = document.getElementById('selectFontScript');
  const customScript = document.getElementById('inputCustomScript');
  const badgeScript = document.getElementById('badgeCustomScriptFile');
  const nameScript = document.getElementById('nameCustomScriptFile');
  if (typo.customScriptFile && typo.customScriptFileName) {
    badgeScript.style.display = 'flex';
    nameScript.textContent = typo.customScriptFileName;
  } else {
    badgeScript.style.display = 'none';
  }
  if (typo.customScript) {
    selectScript.value = 'custom';
    customScript.value = typo.customScript;
    customScript.style.display = 'block';
  } else {
    selectScript.value = typo.scriptFont || 'Parisienne';
    customScript.style.display = 'none';
  }

  // 2. Display Font
  const selectDisplay = document.getElementById('selectFontDisplay');
  const customDisplay = document.getElementById('inputCustomDisplay');
  const badgeDisplay = document.getElementById('badgeCustomDisplayFile');
  const nameDisplay = document.getElementById('nameCustomDisplayFile');
  if (typo.customDisplayFile && typo.customDisplayFileName) {
    badgeDisplay.style.display = 'flex';
    nameDisplay.textContent = typo.customDisplayFileName;
  } else {
    badgeDisplay.style.display = 'none';
  }
  if (typo.customDisplay) {
    selectDisplay.value = 'custom';
    customDisplay.value = typo.customDisplay;
    customDisplay.style.display = 'block';
  } else {
    selectDisplay.value = typo.displayFont || 'Cormorant Garamond';
    customDisplay.style.display = 'none';
  }

  // 3. Body Font
  const selectBody = document.getElementById('selectFontBody');
  const customBody = document.getElementById('inputCustomBody');
  const badgeBody = document.getElementById('badgeCustomBodyFile');
  const nameBody = document.getElementById('nameCustomBodyFile');
  if (typo.customBodyFile && typo.customBodyFileName) {
    badgeBody.style.display = 'flex';
    nameBody.textContent = typo.customBodyFileName;
  } else {
    badgeBody.style.display = 'none';
  }
  if (typo.customBody) {
    selectBody.value = 'custom';
    customBody.value = typo.customBody;
    customBody.style.display = 'block';
  } else {
    selectBody.value = typo.bodyFont || 'Inter';
    customBody.style.display = 'none';
  }

  // 4. Efecto de Títulos
  const titleEffect = typo.titleEffect || 'solid';
  const titleMetallic = typo.titleMetallicPreset || 'gold';
  const selectTitleEffect = document.getElementById('selectTitleEffect');
  const wrapTitleMetallic = document.getElementById('wrapTitleMetallic');
  const wrapTitleSolid = document.getElementById('wrapTitleSolid');
  const selectTitleMetallicPreset = document.getElementById('selectTitleMetallicPreset');
  const inputCustomMetallicGradient = document.getElementById('inputCustomMetallicGradient');
  const inputTitleSolidColor = document.getElementById('inputTitleSolidColor');
  const inputTitleSolidColorHex = document.getElementById('inputTitleSolidColorHex');

  if (selectTitleEffect) selectTitleEffect.value = titleEffect;
  if (wrapTitleMetallic) wrapTitleMetallic.style.display = titleEffect === 'metallic' ? 'block' : 'none';
  if (wrapTitleSolid) wrapTitleSolid.style.display = titleEffect === 'solid' ? 'block' : 'none';

  if (selectTitleMetallicPreset) selectTitleMetallicPreset.value = titleMetallic;
  if (inputCustomMetallicGradient) {
    inputCustomMetallicGradient.value = typo.titleCustomMetallic || '';
    inputCustomMetallicGradient.style.display = titleMetallic === 'custom' ? 'block' : 'none';
  }

  if (inputTitleSolidColor) inputTitleSolidColor.value = typo.titleSolidColor || '#ffffff';
  if (inputTitleSolidColorHex) inputTitleSolidColorHex.value = typo.titleSolidColor || '#ffffff';

  // Escalas Tipográficas
  const scaleHero = typo.scaleHero !== undefined ? typo.scaleHero : 1.0;
  const scaleHeadings = typo.scaleHeadings !== undefined ? typo.scaleHeadings : 1.0;
  const scaleBody = typo.scaleBody !== undefined ? typo.scaleBody : 1.0;

  const rangeScaleHero = document.getElementById('rangeScaleHero');
  const valScaleHero = document.getElementById('valScaleHero');
  const rangeScaleHeadings = document.getElementById('rangeScaleHeadings');
  const valScaleHeadings = document.getElementById('valScaleHeadings');
  const rangeScaleBody = document.getElementById('rangeScaleBody');
  const valScaleBody = document.getElementById('valScaleBody');

  if (rangeScaleHero) rangeScaleHero.value = String(scaleHero);
  if (valScaleHero) valScaleHero.textContent = `${Math.round(scaleHero * 100)}%`;

  if (rangeScaleHeadings) rangeScaleHeadings.value = String(scaleHeadings);
  if (valScaleHeadings) valScaleHeadings.textContent = `${Math.round(scaleHeadings * 100)}%`;

  if (rangeScaleBody) rangeScaleBody.value = String(scaleBody);
  if (valScaleBody) valScaleBody.textContent = `${Math.round(scaleBody * 100)}%`;

  // Fondos por Sección con Imágenes y Opacidad
  const secKeys = [
    { key: 'family', inId: 'inputBgFamilyImage', opId: 'inputBgFamilyOpacity', valId: 'valBgFamilyOpacity', defOp: 35 },
    { key: 'details', inId: 'inputBgDetailsImage', opId: 'inputBgDetailsOpacity', valId: 'valBgDetailsOpacity', defOp: 30 },
    { key: 'dressCode', inId: 'inputBgDressCodeImage', opId: 'inputBgDressCodeOpacity', valId: 'valBgDressCodeOpacity', defOp: 25 },
    { key: 'gallery', inId: 'inputBgGalleryImage', opId: 'inputBgGalleryOpacity', valId: 'valBgGalleryOpacity', defOp: 25 },
    { key: 'giftRegistry', inId: 'inputBgGiftRegistryImage', opId: 'inputBgGiftRegistryOpacity', valId: 'valBgGiftRegistryOpacity', defOp: 25 },
    { key: 'itinerary', inId: 'inputBgItineraryImage', opId: 'inputBgItineraryOpacity', valId: 'valBgItineraryOpacity', defOp: 30 },
    { key: 'sharedAlbum', inId: 'inputBgSharedAlbumImage', opId: 'inputBgSharedAlbumOpacity', valId: 'valBgSharedAlbumOpacity', defOp: 30 },
    { key: 'instagram', inId: 'inputBgInstagramImage', opId: 'inputBgInstagramOpacity', valId: 'valBgInstagramOpacity', defOp: 25 },
    { key: 'rsvp', inId: 'inputBgRsvpImage', opId: 'inputBgRsvpOpacity', valId: 'valBgRsvpOpacity', defOp: 35 }
  ];

  if (!currentConfig.sectionBackgrounds) {
    currentConfig.sectionBackgrounds = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.sectionBackgrounds));
  }

  secKeys.forEach(({ key, inId, opId, valId, defOp }) => {
    let item = currentConfig.sectionBackgrounds[key];
    if (!item) {
      item = { image: '', opacity: defOp / 100 };
      currentConfig.sectionBackgrounds[key] = item;
    } else if (typeof item === 'string') {
      item = { image: item, opacity: defOp / 100 };
      currentConfig.sectionBackgrounds[key] = item;
    }
    const inEl = document.getElementById(inId);
    const opEl = document.getElementById(opId);
    const valEl = document.getElementById(valId);
    const opPercent = Math.round((typeof item.opacity === 'number' ? item.opacity : defOp / 100) * 100);
    if (inEl) inEl.value = item.image || '';
    if (opEl) opEl.value = opPercent;
    if (valEl) valEl.textContent = opPercent + '%';
  });

  // Fecha y Contador
  document.getElementById('inputEventDate').value = currentConfig.eventDateISO || '';
  document.getElementById('inputTimezone').value = currentConfig.timezoneOffset || '-06:00';
  document.getElementById('inputDateLabel').value = currentConfig.eventDateLabel || '';
  document.getElementById('inputDateShort').value = currentConfig.eventDateShort || '';
  document.getElementById('inputCountdownPhrase').value = currentConfig.countdownPhrase || (isWedding ? 'Para casarme con el amor de mi vida' : 'Para mi gran día');
  document.getElementById('inputDuration').value = currentConfig.eventDurationHours || 6;

  // Estilo de Cristal del Contador
  const countStyle = currentConfig.countdownStyle || TemplateEngine.defaultConfig.countdownStyle || {};
  const countBg = countStyle.bgColor || '#121214';
  const countText = countStyle.textColor || '#121214';
  const countOp = typeof countStyle.opacity === 'number' ? countStyle.opacity : 0.55;

  const inCountBg = document.getElementById('inputCountdownBgColor');
  const inCountBgHex = document.getElementById('inputCountdownBgColorHex');
  const inCountText = document.getElementById('inputCountdownTextColor');
  const inCountTextHex = document.getElementById('inputCountdownTextColorHex');
  const inCountOp = document.getElementById('inputCountdownOpacity');
  const valCountOp = document.getElementById('valCountdownOpacity');

  if (inCountBg) inCountBg.value = countBg;
  if (inCountBgHex) inCountBgHex.value = countBg;
  if (inCountText) inCountText.value = countText;
  if (inCountTextHex) inCountTextHex.value = countText;
  if (inCountOp) inCountOp.value = Math.round(countOp * 100);
  if (valCountOp) valCountOp.textContent = Math.round(countOp * 100) + '%';

  // Familia (XV y Boda)
  document.getElementById('inputBlessing').value = currentConfig.blessingIntro || '';
  document.getElementById('inputMother').value = currentConfig.mother || '';
  document.getElementById('inputFather').value = currentConfig.father || '';
  document.getElementById('inputBrideMother').value = currentConfig.brideMother || '';
  document.getElementById('inputBrideFather').value = currentConfig.brideFather || '';
  document.getElementById('inputGroomMother').value = currentConfig.groomMother || '';
  document.getElementById('inputGroomFather').value = currentConfig.groomFather || '';
  document.getElementById('inputGodmother').value = currentConfig.godmother || '';
  document.getElementById('inputGodfather').value = currentConfig.godfather || '';
  
  const isWedPop = currentConfig.eventType === 'boda';
  const lblGpEl = document.getElementById('lblGodparentsHeader');
  const lblCtEl = document.getElementById('lblCourtHeader');
  if (lblGpEl) lblGpEl.textContent = isWedPop ? '✨ Padrinos de Velación' : '✨ Mis Padrinos';
  if (lblCtEl) lblCtEl.textContent = isWedPop ? 'Damas de Honor & Best Men' : 'Mis Chambelanes';
  
  renderCourtTags();

  // Ubicaciones
  document.getElementById('inputCeremonyVenue').value = currentConfig.ceremony.venue || '';
  document.getElementById('inputCeremonyAddress').value = currentConfig.ceremony.address || '';
  document.getElementById('inputCeremonyTime').value = currentConfig.ceremony.time || '';
  document.getElementById('inputCeremonyMap').value = currentConfig.ceremony.mapsUrl || '';
  document.getElementById('inputCeremonyWaze').value = currentConfig.ceremony.wazeUrl || '';

  document.getElementById('inputReceptionVenue').value = currentConfig.reception.venue || '';
  document.getElementById('inputReceptionAddress').value = currentConfig.reception.address || '';
  document.getElementById('inputReceptionTime').value = currentConfig.reception.time || '';
  document.getElementById('inputReceptionMap').value = currentConfig.reception.mapsUrl || '';
  document.getElementById('inputReceptionWaze').value = currentConfig.reception.wazeUrl || '';

  // Polvo de Estrellas
  const stardust = currentConfig.stardust || TemplateEngine.defaultConfig.stardust || {};
  const inSdTitle = document.getElementById('inputStardustTitle');
  const inSdSub = document.getElementById('inputStardustSubtitle');
  const inSdTime = document.getElementById('inputStardustTime');
  const inSdBtn = document.getElementById('inputStardustBtnText');
  const inSdText = document.getElementById('inputStardustText');
  if (inSdTitle) inSdTitle.value = stardust.title || 'Polvo de Estrellas';
  if (inSdSub) inSdSub.value = stardust.subtitle || 'Momento Mágico';
  if (inSdTime) inSdTime.value = stardust.time || '21:30 HRS';
  if (inSdBtn) inSdBtn.value = stardust.buttonText || '✨ Encender mi Luz';
  if (inSdText) inSdText.value = stardust.text || '';

  // Itinerario
  const inItinTitle = document.getElementById('inputItineraryTitle');
  if (inItinTitle) inItinTitle.value = (currentConfig.itinerary && currentConfig.itinerary.title) || currentConfig.itineraryTitle || 'Programa';
  renderItineraryInputs();

  // Regalos
  const giftReg = currentConfig.giftRegistry || {};
  document.getElementById('checkGiftEnabled').checked = giftReg.enabled !== false;
  document.getElementById('giftRegistryFields').style.display = giftReg.enabled !== false ? 'block' : 'none';
  document.getElementById('inputGiftIntro').value = giftReg.intro || '';
  document.getElementById('inputBankName').value = (giftReg.bank && giftReg.bank.bankName) || '';
  document.getElementById('inputBankHolder').value = (giftReg.bank && giftReg.bank.holder) || '';
  document.getElementById('inputBankClabe').value = (giftReg.bank && giftReg.bank.clabe) || '';
  document.getElementById('inputEnvelopeNote').value = giftReg.envelopeNote || '';
  renderGiftStoresInputs();

  // Fotos
  document.getElementById('inputPhotoHero').value = (currentConfig.photos && currentConfig.photos.hero) || '';
  document.getElementById('inputPhotoDate').value = (currentConfig.photos && currentConfig.photos.saveTheDate) || '';
  document.getElementById('inputPhotoPortrait').value = (currentConfig.photos && currentConfig.photos.portrait) || '';
  renderGalleryPhotosInputs();

  // Foto del Contador
  const inCdPhoto = document.getElementById('inputCountdownPhoto');
  const chkCdPhoto = document.getElementById('checkCountdownPhotoEnabled');
  const cdPhotoFields = document.getElementById('countdownPhotoFields');
  if (inCdPhoto) inCdPhoto.value = currentConfig.countdownPhoto || '';
  if (chkCdPhoto) {
    const enabled = currentConfig.countdownPhotoEnabled !== false;
    chkCdPhoto.checked = enabled;
    if (cdPhotoFields) cdPhotoFields.style.display = enabled ? '' : 'none';
  }

  // Álbum Colaborativo
  const sharedAlbum = currentConfig.sharedAlbum || TemplateEngine.defaultConfig.sharedAlbum || {};
  const checkAlbum = document.getElementById('checkSharedAlbumEnabled');
  if (checkAlbum) {
    checkAlbum.checked = sharedAlbum.enabled !== false;
    const albumFields = document.getElementById('sharedAlbumFields');
    if (albumFields) albumFields.style.display = sharedAlbum.enabled !== false ? 'block' : 'none';
    const inAlbTitle = document.getElementById('inputSharedAlbumTitle');
    if (inAlbTitle) inAlbTitle.value = sharedAlbum.title || '';
    const inAlbSub = document.getElementById('inputSharedAlbumSubtitle');
    if (inAlbSub) inAlbSub.value = sharedAlbum.subtitle || '';
    const inAlbDesc = document.getElementById('inputSharedAlbumDesc');
    if (inAlbDesc) inAlbDesc.value = sharedAlbum.description || '';
    const inAlbCode = document.getElementById('inputSharedAlbumCode');
    if (inAlbCode) inAlbCode.value = sharedAlbum.accessCode || '';
    const inAlbUrl = document.getElementById('inputSharedAlbumUrl');
    if (inAlbUrl) inAlbUrl.value = sharedAlbum.albumUrl || '';
  }

  // Música
  const music = currentConfig.music || TemplateEngine.defaultConfig.music || {};
  document.getElementById('checkMusicEnabled').checked = music.enabled !== false;
  document.getElementById('musicFields').style.display = music.enabled !== false ? 'block' : 'none';
  document.getElementById('inputMusicUrl').value = music.url || '';
  document.getElementById('inputMusicTitle').value = music.title || '';

  // Ilustraciones Multi-Plano (Parallax)
  if (!currentConfig.illustrations) {
    currentConfig.illustrations = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.illustrations));
  }
  const populateIllFields = (key, prefix) => {
    const ill = (currentConfig.illustrations && currentConfig.illustrations[key]) || {};
    const chk = document.getElementById(`checkIll${prefix}Enabled`);
    const img = document.getElementById(`inputIll${prefix}Image`);
    const width = document.getElementById(`inputIll${prefix}Width`);
    const valWidth = document.getElementById(`valIll${prefix}Width`);
    const maxWidth = document.getElementById(`inputIll${prefix}MaxWidth`);
    const valMaxWidth = document.getElementById(`valIll${prefix}MaxWidth`);
    const overlap = document.getElementById(`inputIll${prefix}Overlap`);
    const valOverlap = document.getElementById(`valIll${prefix}Overlap`);
    const offsetY = document.getElementById(`inputIll${prefix}OffsetY`);
    const valOffsetY = document.getElementById(`valIll${prefix}OffsetY`);
    const offsetX = document.getElementById(`inputIll${prefix}OffsetX`);
    const valOffsetX = document.getElementById(`valIll${prefix}OffsetX`);
    const extraPad = document.getElementById(`inputIll${prefix}ExtraPad`);
    const valExtraPad = document.getElementById(`valIll${prefix}ExtraPad`);
    const speed = document.getElementById(`inputIll${prefix}ParallaxSpeed`);
    const valSpeed = document.getElementById(`valIll${prefix}ParallaxSpeed`);

    if (chk) chk.checked = ill.enabled !== false && !!ill.image;
    if (img) img.value = ill.image || '';
    if (width) { width.value = ill.widthPct !== undefined ? ill.widthPct : (key === 'hero' ? 85 : 82); if (valWidth) valWidth.textContent = width.value + '%'; }
    if (maxWidth) { maxWidth.value = ill.maxWidth || 560; if (valMaxWidth) valMaxWidth.textContent = (ill.maxWidth || 560) + 'px'; }
    if (overlap) { overlap.value = ill.overlapPct !== undefined ? ill.overlapPct : 50; if (valOverlap) valOverlap.textContent = overlap.value + '%'; }
    if (offsetY) { offsetY.value = ill.offsetY || 0; if (valOffsetY) valOffsetY.textContent = (ill.offsetY || 0) + 'px'; }
    if (offsetX) { offsetX.value = ill.offsetX || 0; if (valOffsetX) valOffsetX.textContent = (ill.offsetX || 0) + 'px'; }
    if (extraPad) { extraPad.value = ill.extraPadding || 0; if (valExtraPad) valExtraPad.textContent = (ill.extraPadding || 0) + 'px'; }
    if (speed) { speed.value = ill.parallaxSpeed !== undefined ? ill.parallaxSpeed : 25; if (valSpeed) valSpeed.textContent = (ill.parallaxSpeed !== undefined ? ill.parallaxSpeed : 25) + '%'; }

    const curAlign = ill.alignX || 'center';
    document.querySelectorAll(`.btn-ill-align[data-target="${key}"]`).forEach(btn => {
      const active = btn.dataset.align === curAlign;
      btn.classList.toggle('active', active);
      btn.style.background = active ? 'var(--primary)' : '';
      btn.style.color = active ? '#ffffff' : '';
    });
  };

  populateIllFields('hero', 'Hero');
  populateIllFields('countdown', 'Countdown');
  populateIllFields('family', 'Family');

  // RSVP
  const rsvpTitle = currentConfig.rsvpTitle || (currentConfig.rsvp && currentConfig.rsvp.title) || 'Confirmación de Asistencia';
  const selRsvpTitle = document.getElementById('selectRsvpTitle');
  const inCustomRsvpTitle = document.getElementById('inputCustomRsvpTitle');
  if (selRsvpTitle) {
    if (rsvpTitle === 'Confirmación de Asistencia' || rsvpTitle === 'RSVP') {
      selRsvpTitle.value = rsvpTitle;
      if (inCustomRsvpTitle) inCustomRsvpTitle.style.display = 'none';
    } else {
      selRsvpTitle.value = 'custom';
      if (inCustomRsvpTitle) {
        inCustomRsvpTitle.value = rsvpTitle;
        inCustomRsvpTitle.style.display = 'block';
      }
    }
  }
  
  if (!currentConfig.whatsappHosts) {
    currentConfig.whatsappHosts = [
      { label: "Anfitrión Principal / Novia", phone: currentConfig.whatsappNumber || "5215512345678" },
      { label: "Segundo Anfitrión / Novio", phone: "" },
      { label: "Coordinador / Planner", phone: "" }
    ];
  }

  const h1 = (currentConfig.whatsappHosts[0] && currentConfig.whatsappHosts[0].phone) || currentConfig.whatsappNumber || '';
  const h2 = (currentConfig.whatsappHosts[1] && currentConfig.whatsappHosts[1].phone) || '';
  const h3 = (currentConfig.whatsappHosts[2] && currentConfig.whatsappHosts[2].phone) || '';
  
  const inH1 = document.getElementById('inputHostPhone1');
  const inH2 = document.getElementById('inputHostPhone2');
  const inH3 = document.getElementById('inputHostPhone3');
  const inWb = document.getElementById('inputRsvpWebhook');
  const inWa = document.getElementById('inputWhatsapp');

  if (inH1) inH1.value = h1;
  if (inH2) inH2.value = h2;
  if (inH3) inH3.value = h3;
  if (inWb) inWb.value = currentConfig.rsvpWebhookUrl || '';
  if (inWa) inWa.value = h1;
  
  // RSVP Deadline Populate
  const dLabel = currentConfig.rsvpDeadlineLabel || 'Por favor, haznos saber si podrás acompañarnos antes del 20 de Febrero.';
  const selDay = document.getElementById('selectRsvpDay');
  const selMonth = document.getElementById('selectRsvpMonth');
  const prevDeadline = document.getElementById('previewRsvpDeadlinePhrase');
  if (prevDeadline) prevDeadline.textContent = dLabel;
  if (document.getElementById('inputRsvpDeadline')) document.getElementById('inputRsvpDeadline').value = dLabel;

  if (selDay && selMonth) {
    if (selDay.options.length === 0) {
      for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}`;
        selDay.appendChild(opt);
      }
    }
    const match = dLabel.match(/(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)/i);
    if (match) {
      selDay.value = parseInt(match[1], 10);
      const mStr = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
      Array.from(selMonth.options).forEach(opt => {
        if (opt.value.toLowerCase() === mStr.toLowerCase()) {
          selMonth.value = opt.value;
        }
      });
    }
  }

  // Vendor Card (Lead Magnet)
  const vc = currentConfig.vendorCard || {};
  const checkVc = document.getElementById('checkVendorCardEnabled');
  if (checkVc) checkVc.checked = vc.enabled !== false;
  const inVcBadge = document.getElementById('inputVendorCardBadge');
  if (inVcBadge) inVcBadge.value = vc.badge || '';
  const inVcTitle = document.getElementById('inputVendorCardTitle');
  if (inVcTitle) inVcTitle.value = vc.title || '';
  const inVcDesc = document.getElementById('inputVendorCardDesc');
  if (inVcDesc) inVcDesc.value = vc.description || '';
  const inVcWa = document.getElementById('inputVendorCardWhatsapp');
  if (inVcWa) inVcWa.value = vc.whatsappNumber || '';
  const inVcMsg = document.getElementById('inputVendorCardMsg');
  if (inVcMsg) inVcMsg.value = vc.whatsappMessage || '';
  const inVcBtn = document.getElementById('inputVendorCardBtnText');
  if (inVcBtn) inVcBtn.value = vc.buttonText || '';
  const inVcAgency = document.getElementById('inputVendorCardAgency');
  if (inVcAgency) inVcAgency.value = vc.agencyName || '';
}

function setupInputListeners() {
  const bindings = [
    { id: 'selectEventType', path: 'eventType' },
    { id: 'inputName', path: 'name' },
    { id: 'inputBrideName', path: 'brideName' },
    { id: 'inputGroomName', path: 'groomName' },
    { id: 'inputMonogram', path: 'monogram' },
    { id: 'inputEyebrow', path: 'eyebrow' },
    { id: 'inputWelcome', path: 'welcomeMessage' },
    { id: 'inputQuote', path: 'quote' },
    { id: 'inputFooterClosing', path: 'footerClosing' },
    { id: 'inputFooterText', path: 'footerText' },
    { id: 'inputStoryTitle', path: 'story.title' },
    { id: 'inputStorySubtitle', path: 'story.subtitle' },
    { id: 'inputStoryText', path: 'story.text' },
    { id: 'inputStoryPhoto', path: 'story.photo' },
    { id: 'inputInstagramHashtag', path: 'instagram.hashtag' },
    { id: 'inputInstagramText', path: 'instagram.text' },
    { id: 'inputDressTitle', path: 'dressCode.title' },
    { id: 'inputDressDesc', path: 'dressCode.description' },
    { id: 'inputReservedColors', path: 'dressCode.reservedColorsNote' },
    { id: 'inputLodgingTitle', path: 'lodging.title' },
    { id: 'inputLodgingSubtitle', path: 'lodging.subtitle' },
    { id: 'inputLodgingDesc', path: 'lodging.description' },
    { id: 'inputEventDate', path: 'eventDateISO' },
    { id: 'inputTimezone', path: 'timezoneOffset' },
    { id: 'inputDateLabel', path: 'eventDateLabel' },
    { id: 'inputDateShort', path: 'eventDateShort' },
    { id: 'inputCountdownPhrase', path: 'countdownPhrase' },
    { id: 'inputDuration', path: 'eventDurationHours', isNum: true },
    { id: 'inputBlessing', path: 'blessingIntro' },
    { id: 'inputMother', path: 'mother' },
    { id: 'inputFather', path: 'father' },
    { id: 'inputBrideMother', path: 'brideMother' },
    { id: 'inputBrideFather', path: 'brideFather' },
    { id: 'inputGroomMother', path: 'groomMother' },
    { id: 'inputGroomFather', path: 'groomFather' },
    { id: 'inputGodmother', path: 'godmother' },
    { id: 'inputGodfather', path: 'godfather' },
    { id: 'inputCeremonyVenue', path: 'ceremony.venue' },
    { id: 'inputCeremonyAddress', path: 'ceremony.address' },
    { id: 'inputCeremonyTime', path: 'ceremony.time' },
    { id: 'inputCeremonyMap', path: 'ceremony.mapsUrl' },
    { id: 'inputCeremonyWaze', path: 'ceremony.wazeUrl' },
    { id: 'inputReceptionVenue', path: 'reception.venue' },
    { id: 'inputReceptionAddress', path: 'reception.address' },
    { id: 'inputReceptionTime', path: 'reception.time' },
    { id: 'inputReceptionMap', path: 'reception.mapsUrl' },
    { id: 'inputReceptionWaze', path: 'reception.wazeUrl' },
    { id: 'inputStardustTitle', path: 'stardust.title' },
    { id: 'inputStardustSubtitle', path: 'stardust.subtitle' },
    { id: 'inputStardustTime', path: 'stardust.time' },
    { id: 'inputStardustBtnText', path: 'stardust.buttonText' },
    { id: 'inputStardustText', path: 'stardust.text' },
    { id: 'inputGiftIntro', path: 'giftRegistry.intro' },
    { id: 'inputBankName', path: 'giftRegistry.bank.bankName' },
    { id: 'inputBankHolder', path: 'giftRegistry.bank.holder' },
    { id: 'inputBankClabe', path: 'giftRegistry.bank.clabe' },
    { id: 'inputEnvelopeNote', path: 'giftRegistry.envelopeNote' },
    { id: 'inputPhotoHero', path: 'photos.hero' },
    { id: 'inputPhotoDate', path: 'photos.saveTheDate' },
    { id: 'inputPhotoPortrait', path: 'photos.portrait' },
    { id: 'inputCountdownPhoto', path: 'countdownPhoto' },
    { id: 'inputSharedAlbumTitle', path: 'sharedAlbum.title' },
    { id: 'inputSharedAlbumSubtitle', path: 'sharedAlbum.subtitle' },
    { id: 'inputSharedAlbumDesc', path: 'sharedAlbum.description' },
    { id: 'inputSharedAlbumCode', path: 'sharedAlbum.accessCode' },
    { id: 'inputSharedAlbumUrl', path: 'sharedAlbum.albumUrl' },
    { id: 'inputMusicUrl', path: 'music.url' },
    { id: 'inputMusicTitle', path: 'music.title' },
    { id: 'inputWhatsapp', path: 'whatsappNumber' },
    { id: 'inputRsvpDeadline', path: 'rsvpDeadlineLabel' },
    { id: 'inputVendorCardBadge', path: 'vendorCard.badge' },
    { id: 'inputVendorCardTitle', path: 'vendorCard.title' },
    { id: 'inputVendorCardDesc', path: 'vendorCard.description' },
    { id: 'inputVendorCardWhatsapp', path: 'vendorCard.whatsappNumber' },
    { id: 'inputVendorCardMsg', path: 'vendorCard.whatsappMessage' },
    { id: 'inputVendorCardBtnText', path: 'vendorCard.buttonText' },
    { id: 'inputVendorCardAgency', path: 'vendorCard.agencyName' },
    { id: 'inputItineraryTitle', path: 'itineraryTitle' }
  ];

  bindings.forEach(({ id, path, isNum }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = (e) => {
      setObjectPath(currentConfig, path, isNum ? parseFloat(e.target.value) || 0 : e.target.value);
      schedulePreviewUpdate();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  const checkGift = document.getElementById('checkGiftEnabled');
  if (checkGift) {
    checkGift.addEventListener('change', (e) => {
      if (!currentConfig.giftRegistry) currentConfig.giftRegistry = {};
      currentConfig.giftRegistry.enabled = e.target.checked;
      const f = document.getElementById('giftRegistryFields');
      if (f) f.style.display = e.target.checked ? 'block' : 'none';
      schedulePreviewUpdate();
    });
  }

  const checkAlbum = document.getElementById('checkSharedAlbumEnabled');
  if (checkAlbum) {
    checkAlbum.addEventListener('change', (e) => {
      if (!currentConfig.sharedAlbum) currentConfig.sharedAlbum = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.sharedAlbum));
      currentConfig.sharedAlbum.enabled = e.target.checked;
      const f = document.getElementById('sharedAlbumFields');
      if (f) f.style.display = e.target.checked ? 'block' : 'none';
      schedulePreviewUpdate();
    });
  }

  const checkVendorCard = document.getElementById('checkVendorCardEnabled');
  if (checkVendorCard) {
    checkVendorCard.addEventListener('change', (e) => {
      if (!currentConfig.vendorCard) currentConfig.vendorCard = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.vendorCard));
      currentConfig.vendorCard.enabled = e.target.checked;
      const f = document.getElementById('vendorCardFields');
      if (f) f.style.display = e.target.checked ? 'block' : 'none';
      schedulePreviewUpdate();
    });
  }

  // Event Listeners para Personalización de Cristal del Contador
  if (!currentConfig.countdownStyle) currentConfig.countdownStyle = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.countdownStyle));

  const inCountBg = document.getElementById('inputCountdownBgColor');
  const inCountBgHex = document.getElementById('inputCountdownBgColorHex');
  const inCountText = document.getElementById('inputCountdownTextColor');
  const inCountTextHex = document.getElementById('inputCountdownTextColorHex');
  const inCountOp = document.getElementById('inputCountdownOpacity');
  const valCountOp = document.getElementById('valCountdownOpacity');

  if (inCountBg) {
    inCountBg.addEventListener('input', (e) => {
      currentConfig.countdownStyle.bgColor = e.target.value;
      if (inCountBgHex) inCountBgHex.value = e.target.value;
      schedulePreviewUpdate();
    });
  }

  if (inCountBgHex) {
    inCountBgHex.addEventListener('input', (e) => {
      currentConfig.countdownStyle.bgColor = e.target.value;
      if (inCountBg) inCountBg.value = e.target.value;
      schedulePreviewUpdate();
    });
  }

  if (inCountText) {
    inCountText.addEventListener('input', (e) => {
      currentConfig.countdownStyle.textColor = e.target.value;
      if (inCountTextHex) inCountTextHex.value = e.target.value;
      schedulePreviewUpdate();
    });
  }

  if (inCountTextHex) {
    inCountTextHex.addEventListener('input', (e) => {
      currentConfig.countdownStyle.textColor = e.target.value;
      if (inCountText) inCountText.value = e.target.value;
      schedulePreviewUpdate();
    });
  }

  if (inCountOp) {
    inCountOp.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      currentConfig.countdownStyle.opacity = val / 100;
      if (valCountOp) valCountOp.textContent = val + '%';
      schedulePreviewUpdate();
    });
  }

  // Música Toggle & File Upload
  const checkMusic = document.getElementById('checkMusicEnabled');
  const musicFields = document.getElementById('musicFields');
  const fileAudio = document.getElementById('fileMusicAudio');
  const inputMusicUrl = document.getElementById('inputMusicUrl');

  if (checkMusic) {
    checkMusic.addEventListener('change', (e) => {
      if (!currentConfig.music) currentConfig.music = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.music));
      currentConfig.music.enabled = e.target.checked;
      if (musicFields) musicFields.style.display = e.target.checked ? 'block' : 'none';
      schedulePreviewUpdate();
    });
  }

  if (fileAudio) {
    fileAudio.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_]/g, " ").trim();
        const reader = new FileReader();
        reader.onload = (re) => {
          if (!currentConfig.music) currentConfig.music = {};
          currentConfig.music.url = re.target.result;
          currentConfig.music.title = cleanTitle;
          if (inputMusicUrl) inputMusicUrl.value = re.target.result;
          const inTitle = document.getElementById('inputMusicTitle');
          if (inTitle) inTitle.value = cleanTitle;
          schedulePreviewUpdate();
          showToast(`Canción asignada: "${cleanTitle}"`);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const btnClearMusic = document.getElementById('btnClearMusicAudio');
  if (btnClearMusic) {
    btnClearMusic.addEventListener('click', () => {
      if (currentConfig.music) {
        currentConfig.music.url = '';
      }
      if (inputMusicUrl) inputMusicUrl.value = '';
      if (fileAudio) fileAudio.value = '';
      schedulePreviewUpdate();
      showToast('Archivo de música eliminado');
    });
  }

  // Conector de Nombres de Boda (+, &, y)
  const selConn = document.getElementById('selectNameConnector');
  const inCustomConn = document.getElementById('inputCustomNameConnector');
  if (selConn) {
    selConn.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        if (inCustomConn) {
          inCustomConn.style.display = 'block';
          inCustomConn.focus();
        }
      } else {
        if (inCustomConn) inCustomConn.style.display = 'none';
        currentConfig.nameConnector = e.target.value;
        schedulePreviewUpdate();
      }
    });
  }

  if (inCustomConn) {
    inCustomConn.addEventListener('input', (e) => {
      currentConfig.nameConnector = e.target.value;
      schedulePreviewUpdate();
    });
  }

  // Listeners para Fondos por Sección (Subida de Imagen, Slider de Opacidad y Presets)
  const secConfigs = [
    { key: 'family', inId: 'inputBgFamilyImage', fileId: 'fileBgFamily', opId: 'inputBgFamilyOpacity', valId: 'valBgFamilyOpacity', clearId: 'btnClearBgFamily', defOp: 35 },
    { key: 'details', inId: 'inputBgDetailsImage', fileId: 'fileBgDetails', opId: 'inputBgDetailsOpacity', valId: 'valBgDetailsOpacity', clearId: 'btnClearBgDetails', defOp: 30 },
    { key: 'dressCode', inId: 'inputBgDressCodeImage', fileId: 'fileBgDressCode', opId: 'inputBgDressCodeOpacity', valId: 'valBgDressCodeOpacity', clearId: 'btnClearBgDressCode', defOp: 25 },
    { key: 'gallery', inId: 'inputBgGalleryImage', fileId: 'fileBgGallery', opId: 'inputBgGalleryOpacity', valId: 'valBgGalleryOpacity', clearId: 'btnClearBgGallery', defOp: 25 },
    { key: 'giftRegistry', inId: 'inputBgGiftRegistryImage', fileId: 'fileBgGiftRegistry', opId: 'inputBgGiftRegistryOpacity', valId: 'valBgGiftRegistryOpacity', clearId: 'btnClearBgGiftRegistry', defOp: 25 },
    { key: 'itinerary', inId: 'inputBgItineraryImage', fileId: 'fileBgItinerary', opId: 'inputBgItineraryOpacity', valId: 'valBgItineraryOpacity', clearId: 'btnClearBgItinerary', defOp: 30 },
    { key: 'sharedAlbum', inId: 'inputBgSharedAlbumImage', fileId: 'fileBgSharedAlbum', opId: 'inputBgSharedAlbumOpacity', valId: 'valBgSharedAlbumOpacity', clearId: 'btnClearBgSharedAlbum', defOp: 30 },
    { key: 'instagram', inId: 'inputBgInstagramImage', fileId: 'fileBgInstagram', opId: 'inputBgInstagramOpacity', valId: 'valBgInstagramOpacity', clearId: 'btnClearBgInstagram', defOp: 25 },
    { key: 'rsvp', inId: 'inputBgRsvpImage', fileId: 'fileBgRsvp', opId: 'inputBgRsvpOpacity', valId: 'valBgRsvpOpacity', clearId: 'btnClearBgRsvp', defOp: 35 }
  ];

  secConfigs.forEach(({ key, inId, fileId, opId, valId, clearId, defOp }) => {
    const inEl = document.getElementById(inId);
    const fileEl = document.getElementById(fileId);
    const opEl = document.getElementById(opId);
    const valEl = document.getElementById(valId);
    const clearEl = document.getElementById(clearId);

    if (inEl) {
      inEl.addEventListener('input', (e) => {
        if (!currentConfig.sectionBackgrounds) currentConfig.sectionBackgrounds = {};
        if (!currentConfig.sectionBackgrounds[key]) currentConfig.sectionBackgrounds[key] = { opacity: defOp / 100 };
        currentConfig.sectionBackgrounds[key].image = e.target.value;
        schedulePreviewUpdate();
      });
    }

    if (fileEl) {
      fileEl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            if (!currentConfig.sectionBackgrounds) currentConfig.sectionBackgrounds = {};
            if (!currentConfig.sectionBackgrounds[key]) currentConfig.sectionBackgrounds[key] = { opacity: defOp / 100 };
            currentConfig.sectionBackgrounds[key].image = re.target.result;
            if (inEl) inEl.value = re.target.result;
            schedulePreviewUpdate();
            showToast('Fondo cargado para la sección');
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (opEl) {
      opEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!currentConfig.sectionBackgrounds) currentConfig.sectionBackgrounds = {};
        if (!currentConfig.sectionBackgrounds[key]) currentConfig.sectionBackgrounds[key] = { image: '' };
        currentConfig.sectionBackgrounds[key].opacity = val / 100;
        if (valEl) valEl.textContent = val + '%';
        schedulePreviewUpdate();
      });
    }

    if (clearEl) {
      clearEl.addEventListener('click', () => {
        if (currentConfig.sectionBackgrounds && currentConfig.sectionBackgrounds[key]) {
          currentConfig.sectionBackgrounds[key].image = '';
        }
        if (inEl) inEl.value = '';
        if (fileEl) fileEl.value = '';
        schedulePreviewUpdate();
        showToast('Fondo removido');
      });
    }
  });

  // Presets de Fondos de Lujo
  function applyGlobalBgPreset(url, opacityPercent) {
    if (!currentConfig.sectionBackgrounds) currentConfig.sectionBackgrounds = {};
    secConfigs.forEach(({ key, inId, opId, valId }) => {
      currentConfig.sectionBackgrounds[key] = {
        image: url,
        opacity: opacityPercent / 100
      };
      const inEl = document.getElementById(inId);
      const opEl = document.getElementById(opId);
      const valEl = document.getElementById(valId);
      if (inEl) inEl.value = url;
      if (opEl) opEl.value = opacityPercent;
      if (valEl) valEl.textContent = opacityPercent + '%';
    });
    schedulePreviewUpdate();
  }

  const btnClearAll = document.getElementById('btnClearAllBgs');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      applyGlobalBgPreset('', 30);
      showToast('Todos los fondos han sido limpiados');
    });
  }

}

// Presets de Ilustraciones Botánicas y Florales de Alta Definición (Base64 Vectorial)
const ILLUSTRATION_PRESETS = {
  goldArch: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgMjgwIiBmaWxsPSJub25lIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdvbGRHIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIlMjNFNUMwN0IiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iJTIzRDRBRjM3Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIlMjNBQTdDMTEiLz48L2xpbmVhckdyYWRpZW50PjxmaWx0ZXIgaWQ9Imdsb3ciPjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjMiIHJlc3VsdD0iY29sb3JlZEJsdXIiLz48ZmVNZXJnZT48ZmVNZXJnZU5vZGUgaW49ImNvbG9yZWRCbHVyIi8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjwvZGVmcz48ZyBmaWx0ZXI9InVybCglMjNnbG93KSI+PHBhdGggZD0iTTUwIDIwMCBDIDIwMCA0MCwgNjAwIDQwLCA3NTAgMjAwIiBzdHJva2U9InVybCglMjNnb2xkRykiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTEyMCAxODAgQyAyNTAgODAsIDU1MCA4MCwgNjgwIDE4MCIgc3Ryb2tlPSJ1cmwoJTIzZ29sZEcpIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iNiA0IiBmaWxsPSJub25lIi8+PGNpcmNsZSBjeD0iNDAwIiBjeT0iNzAiIHI9IjE0IiBmaWxsPSJub25lIiBzdHJva2U9InVybCglMjNnb2xkRykiIHN0cm9rZS13aWR0aD0iMiIvPjxjaXJjbGUgY3g9IjQwMCIgY3k9IjcwIiByPSI2IiBmaWxsPSJ1cmwoJTIzZ29sZEcpIi8+PHBhdGggZD0iTTM4MCA3MCBRIDQwMCA0NSA0MjAgNzAgUSA0MDAgOTUgMzgwIDcwIFoiIGZpbGw9InVybCglMjNnb2xkRykiIG9wYWNpdHk9IjAuNzUiLz48ZyBmaWxsPSJ1cmwoJTIzZ29sZEcpIj48Y2lyY2xlIGN4PSIyODAiIGN5PSIxMDAiIHI9IjUiLz48cGF0aCBkPSJNMjcwIDk1IFEgMjg1IDc1IDMwMCA5NSBRIDI4NSAxMTUgMjcwIDk1IFoiIG9wYWNpdHk9IjAuOCIvPjxjaXJjbGUgY3g9IjUyMCIgY3k9IjEwMCIgcj0iNSIvPjxwYXRoIGQ9Ik01MTAgOTUgUSA1MjUgNzUgNTQwIDk1IFEgNTI1IDExNSA1MTAgOTUgWiIgb3BhY2l0eT0iMC44Ii8+PGNpcmNsZSBjeD0iMjAwIiBjeT0iMTQwIiByPSI0Ii8+PHBhdGggZD0iTTE5MCAxMzUgUSAyMDUgMTE1IDIyMCAxMzUgUSAyMDUgMTU1IDE5MCAxMzUgWiIgb3BhY2l0eT0iMC43Ii8+PGNpcmNsZSBjeD0iNjAwIiBjeT0iMTQwIiByPSI0Ii8+PHBhdGggZD0iTTU5MCAxMzUgUSA2MDUgMTE1IDYyMCAxMzUgUSA2MDUgMTU1IDU5MCAxMzUgWiIgb3BhY2l0eT0iMC43Ii8+PC9nPjwvZz48L3N2Zz4=',
  oliveBranch: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgMjYwIiBmaWxsPSJub25lIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9InNhZ2VHIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIlMjM4REEzOTkiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iJTIzNkI4RTdCIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIlMjNDMkE2NDkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyBzdHJva2U9InVybCglMjNzYWdlRykiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik04MCAxODAgUSA0MDAgNjAgNzIwIDE4MCIgc3Ryb2tlLXdpZHRoPSIyLjUiLz48ZyBmaWxsPSJ1cmwoJTIzc2FnZUcpIiBvcGFjaXR5PSIwLjg1Ij48cGF0aCBkPSJNMjIwIDEzNSBDIDIxMCAxMDUgMjQwIDEwMCAyNTAgMTMwIEMgMjUwIDE0NSAyMzAgMTUwIDIyMCAxMzUgWiIvPjxwYXRoIGQ9Ik0zMDAgMTA1IEMgMjkwIDc1IDMyMCA3MCAzMzAgMTAwIEMgMzMwIDExNSAzMTAgMTIwIDMwMCAxMDUgWiIvPjxwYXRoIGQ9Ik0zODAgOTAgQyAzNzUgNjAgNDA1IDU1IDQxMCA4NSBDIDQxMCAxMDAgMzkwIDEwNSAzODAgOTAgWiIvPjxwYXRoIGQ9Ik00ODAgMTAwIEMgNDkwIDcwIDQ2MCA2NSA0NTAgOTUgQyA0NTAgMTEwIDQ3MCAxMTUgNDgwIDEwMCBaIi8+PHBhdGggZD0iTTU2MCAxMjAgQyA1NzAgOTAgNTQwIDg1IDUzMCAxMTUgQyA1MzAgMTMwIDU1MCAxMzUgNTYwIDEyMCBaIi8+PHBhdGggZD0iTTY0MCAxNTAgQyA2NTAgMTIwIDYyMCAxMTUgNjEwIDE0NSBDIDYxMCAxNjAgNjMwIDE2NSA2NDAgMTUwIFoiLz48L2c+PGcgZmlsbD0iJTIzNEE1RDRFIiBvcGFjaXR5PSIwLjkiPjxjaXJjbGUgY3g9IjI2MCIgY3k9IjE0MCIgcj0iNiIvPjxjaXJjbGUgY3g9IjM1MCIgY3k9IjEwNSIgcj0iNiIvPjxjaXJjbGUgY3g9IjQ0MCIgY3k9IjEwMCIgcj0iNiIvPjxjaXJjbGUgY3g9IjUzMCIgY3k9IjEyNSIgcj0iNiIvPjwvZz48L2c+PC9zdmc+',
  champagneFlowers: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgMjYwIiBmaWxsPSJub25lIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9InJvc2VHIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIlMjNGNEQwQzUiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iJTIzRTBBODk5Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIlMjNDNTlCMjciLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyBzdHJva2U9InVybCglMjNyb3NlRykiPjxwYXRoIGQ9Ik0xMDAgMTkwIFEgNDAwIDQwIDcwMCAxOTAiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjxnIGZpbGw9InVybCglMjNyb3NlRykiPjxjaXJjbGUgY3g9IjQwMCIgY3k9IjgwIiByPSIyMiIgb3BhY2l0eT0iMC4zIi8+PGNpcmNsZSBjeD0iNDAwIiBjeT0iODAiIHI9IjE0IiBvcGFjaXR5PSIwLjYiLz48Y2lyY2xlIGN4PSI0MDAiIGN5PSI4MCIgcj0iNiIvPjxjaXJjbGUgY3g9IjMxMCIgY3k9IjExNSIgcj0iMTYiIG9wYWNpdHk9IjAuMyIvPjxjaXJjbGUgY3g9IjMxMCIgY3k9IjExNSIgcj0iMTAiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjMxMCIgY3k9IjExNSIgcj0iNCIvPjxjaXJjbGUgY3g9IjQ5MCIgY3k9IjExNSIgcj0iMTYiIG9wYWNpdHk9IjAuMyIvPjxjaXJjbGUgY3g9IjQ5MCIgY3k9IjExNSIgcj0iMTAiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjQ5MCIgY3k9IjExNSIgcj0iNCIvPjxwYXRoIGQ9Ik0zODAgNjAgUSA0MDAgMzAgNDIwIDYwIFoiIG9wYWNpdHk9IjAuNzUiLz48cGF0aCBkPSJNMzUwIDk1IFEgMzMwIDc1IDM1NSA3MCBaIiBvcGFjaXR5PSIwLjc1Ii8+PHBhdGggZD0iTTQ1MCA5NSBRIDQ3MCA3NSA0NDUgNzAgWiIgb3BhY2l0eT0iMC43NSIvPjwvZz48L2c+PC9zdmc+',
  botanicalCrest: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgMjYwIiBmaWxsPSJub25lIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNyZXN0RyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iJTIzRjdGNkVDIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiUyM0Q0QUYzNyIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iJTIzOTk2NTE1Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PGcgc3Ryb2tlPSJ1cmwoJTIzY3Jlc3RHKSIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTI2MCAxNzAgQyAyMjAgOTAsIDM2MCA0MCwgNDAwIDgwIEMgNDQwIDQwLCA1ODAgOTAsIDU0MCAxNzAiIHN0cm9rZS13aWR0aD0iMi41Ii8+PHBvbHlnb24gcG9pbnRzPSI0MDAsNjAgNDEyLDgwIDQwMCwxMDAgMzg4LDgwIiBmaWxsPSJ1cmwoJTIzY3Jlc3RHKSIgb3BhY2l0eT0iMC44NSIvPjxjaXJjbGUgY3g9IjQwMCIgY3k9IjgwIiByPSIzIiBmaWxsPSIlMjNmZmYiLz48ZyBmaWxsPSJ1cmwoJTIzY3Jlc3RHKSIgb3BhY2l0eT0iMC43Ij48cGF0aCBkPSJNMzAwIDEzMCBDIDI5MCAxMTAsIDMxNSAxMDAsIDMyMCAxMjAgWiIvPjxwYXRoIGQ9Ik0zNDAgMTAwIEMgMzMwIDgwLCAzNTUgNzAsIDM2MCA5MCBaIi8+PHBhdGggZD0iTTUwMCAxMzAgQyA1MTAgMTEwLCA0ODUgMTAwLCA0ODAgMTIwIFoiLz48cGF0aCBkPSJNNDYwIDEwMCBDIDQ3MCA4MCwgNDQ1IDcwLCA0NDAgOTAgWiIvPjwvZz48L2c+PC9zdmc+'
};

// ==================== ILUSTRACIONES MULTI-PLANO (PARALLAX) ====================
function setupIllustrationControls() {
  if (!currentConfig.illustrations) {
    currentConfig.illustrations = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.illustrations));
  }

  function setupIllustrationListeners(key, prefix, bridgeId) {
    const ensure = () => {
      if (!currentConfig.illustrations) currentConfig.illustrations = {};
      if (!currentConfig.illustrations[key]) {
        currentConfig.illustrations[key] = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig.illustrations[key] || {}));
      }
      return currentConfig.illustrations[key];
    };

    const updateLiveDOM = () => {
      const d = ensure();
      const iframe = document.getElementById('previewFrame');
      if (iframe && iframe.contentDocument) {
        const el = iframe.contentDocument.getElementById(bridgeId);
        if (el) {
          const overlap = d.overlapPct !== undefined ? Number(d.overlapPct) : 50;
          const offY = Number(d.offsetY || 0);
          const offX = Number(d.offsetX || 0);
          const wPct = Number(d.widthPct || (key === 'hero' ? 85 : 82));
          const maxW = Number(d.maxWidth || 560);
          const align = d.alignX || 'center';

          el.style.bottom = `calc(-${Math.round(overlap / 2)}% + ${offY}px)`;
          el.style.width = `${wPct}%`;
          el.style.maxWidth = `${maxW}px`;

          if (align === 'left') {
            el.style.left = `calc(3% + ${offX}px)`;
            el.style.right = 'auto';
            el.style.transform = 'none';
          } else if (align === 'right') {
            el.style.right = `calc(3% - ${offX}px)`;
            el.style.left = 'auto';
            el.style.transform = 'none';
          } else {
            el.style.left = `calc(50% + ${offX}px)`;
            el.style.right = 'auto';
            el.style.transform = 'translateX(-50%)';
          }
        }
      }
    };

    const chkEl = document.getElementById(`checkIll${prefix}Enabled`);
    const imgEl = document.getElementById(`inputIll${prefix}Image`);
    const fileEl = document.getElementById(`fileIll${prefix}`);
    const widthEl = document.getElementById(`inputIll${prefix}Width`);
    const valWidthEl = document.getElementById(`valIll${prefix}Width`);
    const maxWEl = document.getElementById(`inputIll${prefix}MaxWidth`);
    const valMaxWEl = document.getElementById(`valIll${prefix}MaxWidth`);
    const overlapEl = document.getElementById(`inputIll${prefix}Overlap`);
    const valOverlapEl = document.getElementById(`valIll${prefix}Overlap`);
    const offYEl = document.getElementById(`inputIll${prefix}OffsetY`);
    const valOffYEl = document.getElementById(`valIll${prefix}OffsetY`);
    const offXEl = document.getElementById(`inputIll${prefix}OffsetX`);
    const valOffXEl = document.getElementById(`valIll${prefix}OffsetX`);
    const extraPadEl = document.getElementById(`inputIll${prefix}ExtraPad`);
    const valExtraPadEl = document.getElementById(`valIll${prefix}ExtraPad`);
    const speedEl = document.getElementById(`inputIll${prefix}ParallaxSpeed`);
    const valSpeedEl = document.getElementById(`valIll${prefix}ParallaxSpeed`);
    const clearEl = document.getElementById(`btnClearIll${prefix}`);
    const resetEl = document.getElementById(`btnResetIll${prefix}`);

    if (chkEl) {
      chkEl.addEventListener('change', (e) => {
        const d = ensure();
        d.enabled = e.target.checked;
        // Si se activa y no tiene imagen, asignar el preset floral por defecto
        if (d.enabled && (!d.image || !d.image.trim())) {
          const defaultPreset = key === 'hero' ? 'goldArch' : (key === 'countdown' ? 'oliveBranch' : 'champagneFlowers');
          d.image = ILLUSTRATION_PRESETS[defaultPreset] || '';
          if (imgEl) imgEl.value = d.image;
        }
        schedulePreviewUpdate();
      });
    }

    if (imgEl) {
      imgEl.addEventListener('input', (e) => {
        const d = ensure();
        d.image = e.target.value;
        d.enabled = !!e.target.value;
        if (chkEl) chkEl.checked = !!e.target.value;
        schedulePreviewUpdate();
      });
    }

    // Botones de Presets Rápidos
    document.querySelectorAll(`.btn-preset-ill[data-target="${key}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        const presetUrl = ILLUSTRATION_PRESETS[presetKey];
        if (presetUrl) {
          const d = ensure();
          d.image = presetUrl;
          d.enabled = true;
          if (imgEl) imgEl.value = presetUrl;
          if (chkEl) chkEl.checked = true;
          schedulePreviewUpdate();
          showToast(`Preset aplicado: ${btn.textContent.trim()}`);
        }
      });
    });

    if (fileEl) {
      fileEl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const d = ensure();
            d.image = re.target.result;
            d.enabled = true;
            if (imgEl) imgEl.value = re.target.result;
            if (chkEl) chkEl.checked = true;
            schedulePreviewUpdate();
            showToast(`Ilustración ${prefix} cargada`);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (widthEl) {
      widthEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ensure().widthPct = val;
        if (valWidthEl) valWidthEl.textContent = val + '%';
        updateLiveDOM();
        schedulePreviewUpdate();
      });
    }

    if (maxWEl) {
      maxWEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ensure().maxWidth = val;
        if (valMaxWEl) valMaxWEl.textContent = val + 'px';
        updateLiveDOM();
        schedulePreviewUpdate();
      });
    }

    if (overlapEl) {
      overlapEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ensure().overlapPct = val;
        if (valOverlapEl) valOverlapEl.textContent = val + '%';
        updateLiveDOM();
        schedulePreviewUpdate();
      });
    }

    if (offYEl) {
      offYEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ensure().offsetY = val;
        if (valOffYEl) valOffYEl.textContent = val + 'px';
        updateLiveDOM();
        schedulePreviewUpdate();
      });
    }

    if (offXEl) {
      offXEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ensure().offsetX = val;
        if (valOffXEl) valOffXEl.textContent = val + 'px';
        updateLiveDOM();
        schedulePreviewUpdate();
      });
    }

    if (extraPadEl) {
      extraPadEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ensure().extraPadding = val;
        if (valExtraPadEl) valExtraPadEl.textContent = val + 'px';
        schedulePreviewUpdate();
      });
    }

    if (speedEl) {
      speedEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ensure().parallaxSpeed = val;
        if (valSpeedEl) valSpeedEl.textContent = val + '%';
        schedulePreviewUpdate();
      });
    }

    // Align Buttons
    document.querySelectorAll(`.btn-ill-align[data-target="${key}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.dataset.align;
        ensure().alignX = align;
        document.querySelectorAll(`.btn-ill-align[data-target="${key}"]`).forEach(b => {
          const isAct = b.dataset.align === align;
          b.classList.toggle('active', isAct);
        });
        updateLiveDOM();
        schedulePreviewUpdate();
      });
    });

    if (clearEl) {
      clearEl.addEventListener('click', () => {
        const d = ensure();
        d.image = '';
        d.enabled = false;
        if (imgEl) imgEl.value = '';
        if (fileEl) fileEl.value = '';
        if (chkEl) chkEl.checked = false;
        schedulePreviewUpdate();
        showToast('Ilustración removida');
      });
    }

    if (resetEl) {
      resetEl.addEventListener('click', () => {
        const d = ensure();
        d.widthPct = key === 'hero' ? 85 : 82;
        d.maxWidth = 560;
        d.overlapPct = 50;
        d.offsetY = 0;
        d.offsetX = 0;
        d.alignX = 'center';
        d.extraPadding = 0;
        d.parallaxSpeed = 25;
        
        if (widthEl) widthEl.value = d.widthPct;
        if (valWidthEl) valWidthEl.textContent = d.widthPct + '%';
        if (maxWEl) maxWEl.value = d.maxWidth;
        if (valMaxWEl) valMaxWEl.textContent = d.maxWidth + 'px';
        if (overlapEl) overlapEl.value = d.overlapPct;
        if (valOverlapEl) valOverlapEl.textContent = d.overlapPct + '%';
        if (offYEl) offYEl.value = '0';
        if (valOffYEl) valOffYEl.textContent = '0px';
        if (offXEl) offXEl.value = '0';
        if (valOffXEl) valOffXEl.textContent = '0px';
        if (extraPadEl) extraPadEl.value = '0';
        if (valExtraPadEl) valExtraPadEl.textContent = '0px';
        if (speedEl) speedEl.value = '25';
        if (valSpeedEl) valSpeedEl.textContent = '25%';

        document.querySelectorAll(`.btn-ill-align[data-target="${key}"]`).forEach(b => {
          const isAct = b.dataset.align === 'center';
          b.classList.toggle('active', isAct);
        });

        updateLiveDOM();
        schedulePreviewUpdate();
        showToast('Posición de ilustración restablecida');
      });
    }
  }

  setupIllustrationListeners('hero', 'Hero', 'illustrationBridgeHero');
  setupIllustrationListeners('countdown', 'Countdown', 'illustrationBridgeCountdown');
  setupIllustrationListeners('family', 'Family', 'illustrationBridgeFamily');

  // ── Foto del Contador ─────────────────────────────────────────────────────
  const chkCdPhotoEl = document.getElementById('checkCountdownPhotoEnabled');
  const cdPhotoFieldsEl = document.getElementById('countdownPhotoFields');
  const inCdPhotoEl = document.getElementById('inputCountdownPhoto');
  const fileCdPhotoEl = document.getElementById('inputCountdownPhotoFile');

  if (chkCdPhotoEl) {
    chkCdPhotoEl.addEventListener('change', (e) => {
      currentConfig.countdownPhotoEnabled = e.target.checked;
      if (cdPhotoFieldsEl) cdPhotoFieldsEl.style.display = e.target.checked ? '' : 'none';
      schedulePreviewUpdate();
    });
  }

  if (fileCdPhotoEl) {
    fileCdPhotoEl.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          currentConfig.countdownPhoto = re.target.result;
          if (inCdPhotoEl) inCdPhotoEl.value = re.target.result;
          schedulePreviewUpdate();
          showToast(`Foto del contador cargada: ${file.name}`);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const btnClearCdPhotoEl = document.getElementById('btnClearCountdownPhoto');
  if (btnClearCdPhotoEl) {
    btnClearCdPhotoEl.addEventListener('click', () => {
      currentConfig.countdownPhoto = '';
      if (inCdPhotoEl) inCdPhotoEl.value = '';
      if (fileCdPhotoEl) fileCdPhotoEl.value = '';
      schedulePreviewUpdate();
      showToast('Fotografía del contador eliminada');
    });
  }
}

function setObjectPath(obj, path, value) {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!curr[parts[i]]) curr[parts[i]] = {};
    curr = curr[parts[i]];
  }
  curr[parts[parts.length - 1]] = value;
}

// ==================== DYNAMIC LISTS ====================
function setupDynamicLists() {
  const courtInput = document.getElementById('inputCourtMember');
  const btnAddCourt = document.getElementById('btnAddCourtMember');

  const addCourtMember = () => {
    const val = courtInput.value.trim();
    if (val) {
      if (!currentConfig.court) currentConfig.court = [];
      currentConfig.court.push(val);
      courtInput.value = '';
      renderCourtTags();
      schedulePreviewUpdate();
    }
  };

  btnAddCourt.addEventListener('click', addCourtMember);
  courtInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCourtMember();
    }
  });

  // Itinerario
  document.getElementById('btnAddItineraryStep').addEventListener('click', () => {
    if (!currentConfig.itinerary) currentConfig.itinerary = [];
    currentConfig.itinerary.push({ icon: 'toast', label: 'Nuevo momento', time: '8:30 p.m.' });
    renderItineraryInputs();
    schedulePreviewUpdate();
  });

  const btnAddChoreography = document.getElementById('btnAddChoreographyStep');
  if (btnAddChoreography) {
    btnAddChoreography.addEventListener('click', () => {
      if (!currentConfig.itinerary) currentConfig.itinerary = [];
      currentConfig.itinerary.push({ icon: 'choreography', label: 'Coreografías / Baile Sorpresa', time: '10:15 p.m.' });
      renderItineraryInputs();
      schedulePreviewUpdate();
      showToast('Momento de coreografía añadido');
    });
  }

  // Tiendas
  document.getElementById('btnAddGiftStore').addEventListener('click', () => {
    if (!currentConfig.giftRegistry) currentConfig.giftRegistry = {};
    if (!currentConfig.giftRegistry.stores) currentConfig.giftRegistry.stores = [];
    currentConfig.giftRegistry.stores.push({ name: 'Nueva Tienda', url: 'https://' });
    renderGiftStoresInputs();
    schedulePreviewUpdate();
  });

  // Hospedaje / Hoteles
  const btnAddHotel = document.getElementById('btnAddHotel');
  if (btnAddHotel) {
    btnAddHotel.addEventListener('click', () => {
      if (!currentConfig.lodging) currentConfig.lodging = {};
      if (!currentConfig.lodging.hotels) currentConfig.lodging.hotels = [];
      currentConfig.lodging.hotels.push({
        name: 'Hotel Sugerido',
        address: 'Dirección o zona',
        mapsUrl: 'https://maps.google.com',
        phone: '',
        code: ''
      });
      renderHotelsInputs();
      schedulePreviewUpdate();
      showToast('Hotel sugerido añadido');
    });
  }

  // Galería
  document.getElementById('btnAddGalleryPhoto').addEventListener('click', () => {
    if (!currentConfig.photos) currentConfig.photos = {};
    if (!currentConfig.photos.gallery) currentConfig.photos.gallery = [];
    currentConfig.photos.gallery.push('');
    renderGalleryPhotosInputs();
    schedulePreviewUpdate();
  });
}

function renderCourtTags() {
  const container = document.getElementById('courtTagsContainer');
  container.innerHTML = '';
  (currentConfig.court || []).forEach((name, index) => {
    const badge = document.createElement('span');
    badge.className = 'tag-badge';
    badge.innerHTML = `
      ${name}
      <span class="tag-remove" data-index="${index}" title="Eliminar">&times;</span>
    `;
    badge.querySelector('.tag-remove').addEventListener('click', () => {
      currentConfig.court.splice(index, 1);
      renderCourtTags();
      schedulePreviewUpdate();
    });
    container.appendChild(badge);
  });
}

function renderItineraryInputs() {
  const container = document.getElementById('itineraryList');
  container.innerHTML = '';
  const isXv = currentConfig.eventType !== 'boda';

  (currentConfig.itinerary || []).forEach((step, index) => {
    const row = document.createElement('div');
    row.className = 'dynamic-item';
    row.innerHTML = `
      <select class="step-icon" style="width:138px;">
        <option value="choreography" ${step.icon === 'choreography' ? 'selected' : ''}>Coreografías</option>
        <option value="crown" ${step.icon === 'crown' ? 'selected' : ''}>Coronación / Vals</option>
        <option value="dance" ${step.icon === 'dance' ? 'selected' : ''}>Baile / Vals</option>
        <option value="church" ${step.icon === 'church' ? 'selected' : ''}>Ceremonia / Misa</option>
        <option value="rings" ${step.icon === 'rings' ? 'selected' : ''}>Boda Civil</option>
        <option value="toast" ${step.icon === 'toast' ? 'selected' : ''}>Recepción</option>
        <option value="dinner" ${step.icon === 'dinner' ? 'selected' : ''}>Cena</option>
        <option value="cake" ${step.icon === 'cake' ? 'selected' : ''}>Pastel</option>
        <option value="photo" ${step.icon === 'photo' ? 'selected' : ''}>Sesión Fotos</option>
        <option value="car" ${step.icon === 'car' ? 'selected' : ''}>Fin de Evento</option>
      </select>
      <input type="text" class="step-label" value="${step.label || ''}" placeholder="Evento" style="flex:1;">
      <input type="text" class="step-time" value="${step.time || ''}" placeholder="Hora (ej: 18:00 hrs)" style="width:100px;">
      <button type="button" class="btn-icon-danger" title="Eliminar evento">&times;</button>
    `;

    row.querySelector('.step-icon').addEventListener('change', (e) => {
      step.icon = e.target.value;
      schedulePreviewUpdate();
    });
    row.querySelector('.step-label').addEventListener('input', (e) => {
      step.label = e.target.value;
      schedulePreviewUpdate();
    });
    row.querySelector('.step-time').addEventListener('input', (e) => {
      step.time = e.target.value;
      schedulePreviewUpdate();
    });
    row.querySelector('.btn-icon-danger').addEventListener('click', () => {
      currentConfig.itinerary.splice(index, 1);
      renderItineraryInputs();
      schedulePreviewUpdate();
    });

    container.appendChild(row);
  });
}

function renderGiftStoresInputs() {
  const container = document.getElementById('giftStoresList');
  container.innerHTML = '';
  const stores = (currentConfig.giftRegistry && currentConfig.giftRegistry.stores) || [];
  stores.forEach((store, index) => {
    const row = document.createElement('div');
    row.className = 'dynamic-item';
    row.innerHTML = `
      <input type="text" class="store-name" value="${store.name || ''}" placeholder="Nombre tienda" style="width:130px;">
      <input type="url" class="store-url" value="${store.url || ''}" placeholder="https://..." style="flex:1;">
      <button type="button" class="btn-icon-danger" title="Eliminar tienda">&times;</button>
    `;

    row.querySelector('.store-name').addEventListener('input', (e) => {
      store.name = e.target.value;
      schedulePreviewUpdate();
    });
    row.querySelector('.store-url').addEventListener('input', (e) => {
      store.url = e.target.value;
      schedulePreviewUpdate();
    });
    row.querySelector('.btn-icon-danger').addEventListener('click', () => {
      currentConfig.giftRegistry.stores.splice(index, 1);
      renderGiftStoresInputs();
      schedulePreviewUpdate();
    });

    container.appendChild(row);
  });
}

function renderGalleryPhotosInputs() {
  const container = document.getElementById('galleryPhotosList');
  container.innerHTML = '';
  const photos = (currentConfig.photos && currentConfig.photos.gallery) || [];
  photos.forEach((photoUrl, index) => {
    const row = document.createElement('div');
    row.className = 'dynamic-item';
    row.innerHTML = `
      <div style="width:32px; height:32px; border-radius:4px; background-size:cover; background-position:center; background-color:var(--border-medium); flex-shrink:0; ${photoUrl ? `background-image:url('${photoUrl}');` : ''}"></div>
      <input type="text" class="photo-url" value="${photoUrl || ''}" placeholder="URL de la imagen" style="flex:1;">
      <label class="file-btn" style="padding:6px 10px; font-size:11px;">
        <span class="material-symbols-outlined" style="font-size:14px;">upload_file</span> <input type="file" accept="image/*" class="gallery-file-input" style="display:none;">
      </label>
      <button type="button" class="btn-icon-danger" title="Eliminar foto">&times;</button>
    `;

    const urlInput = row.querySelector('.photo-url');
    const fileInput = row.querySelector('.gallery-file-input');

    urlInput.addEventListener('input', (e) => {
      currentConfig.photos.gallery[index] = e.target.value;
      renderGalleryPhotosInputs();
      schedulePreviewUpdate();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          currentConfig.photos.gallery[index] = re.target.result;
          renderGalleryPhotosInputs();
          schedulePreviewUpdate();
          showToast('Foto añadida con éxito');
        };
        reader.readAsDataURL(file);
      }
    });

    row.querySelector('.btn-icon-danger').addEventListener('click', () => {
      currentConfig.photos.gallery.splice(index, 1);
      renderGalleryPhotosInputs();
      schedulePreviewUpdate();
    });

    container.appendChild(row);
  });
}

// ==================== FILE UPLOADS ====================
function setupFileUploads() {
  const map = [
    { fileId: 'filePhotoHero', inputId: 'inputPhotoHero', clearBtnId: 'btnClearPhotoHero', path: 'photos.hero', name: 'Foto de portada' },
    { fileId: 'filePhotoDate', inputId: 'inputPhotoDate', clearBtnId: 'btnClearPhotoDate', path: 'photos.saveTheDate', name: 'Foto Save The Date' },
    { fileId: 'filePhotoPortrait', inputId: 'inputPhotoPortrait', clearBtnId: 'btnClearPhotoPortrait', path: 'photos.portrait', name: 'Retrato de bienvenida' }
  ];

  map.forEach(({ fileId, inputId, clearBtnId, path, name }) => {
    const fileEl = document.getElementById(fileId);
    const inputEl = document.getElementById(inputId);
    const clearEl = document.getElementById(clearBtnId);

    if (fileEl && inputEl) {
      fileEl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            inputEl.value = re.target.result;
            setObjectPath(currentConfig, path, re.target.result);
            schedulePreviewUpdate();
            showToast(`${name} cargada con éxito`);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (clearEl) {
      clearEl.addEventListener('click', () => {
        if (inputEl) inputEl.value = '';
        if (fileEl) fileEl.value = '';
        setObjectPath(currentConfig, path, '');
        schedulePreviewUpdate();
        showToast(`${name} eliminada`);
      });
    }
  });
}

// ==================== PREVIEW GENERATOR ====================
function schedulePreviewUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updatePreview(false);
  }, 120);
}

function updatePreview(forced = false) {
  const iframe = document.getElementById('previewFrame');
  const decorAssets = typeof DECOR_ASSETS !== 'undefined' ? DECOR_ASSETS : {};
  const html = TemplateEngine.generateHTML(currentConfig, currentThemeName, customTheme, decorAssets);
  iframe.srcdoc = html;
}

// ==================== HEADER ACTIONS & EXPORT ====================
function setupHeaderActions() {
  // 1. Exportar HTML
  document.getElementById('btnExportHtml').addEventListener('click', () => {
    const decorAssets = typeof DECOR_ASSETS !== 'undefined' ? DECOR_ASSETS : {};
    const html = TemplateEngine.generateHTML(currentConfig, currentThemeName, customTheme, decorAssets);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const isWedding = currentConfig.eventType === 'boda';
    const rawName = (isWedding && currentConfig.brideName && currentConfig.groomName)
      ? `${currentConfig.brideName}-y-${currentConfig.groomName}`
      : (currentConfig.name || 'Invitacion');
    const safeName = rawName.toLowerCase().replace(/\s+/g, '-');
    
    a.href = url;
    a.download = `invitacion-${safeName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Invitación de lujo exportada con éxito');
  });

  // 2. Guardar Proyecto JSON
  document.getElementById('btnExportJson').addEventListener('click', () => {
    const projectData = {
      version: "3.2",
      themeName: currentThemeName,
      customTheme: customTheme,
      config: currentConfig
    };
    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const isWedding = currentConfig.eventType === 'boda';
    const rawName = (isWedding && currentConfig.brideName && currentConfig.groomName)
      ? `${currentConfig.brideName}-y-${currentConfig.groomName}`
      : (currentConfig.name || 'Proyecto');
    const safeName = rawName.toLowerCase().replace(/\s+/g, '-');
    
    a.href = url;
    a.download = `proyecto-${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Proyecto guardado como JSON');
  });

  // 3. Cargar Proyecto JSON
  const jsonInput = document.getElementById('jsonFileInput');
  document.getElementById('btnImportJson').addEventListener('click', () => {
    jsonInput.click();
  });

  jsonInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const data = JSON.parse(re.target.result);
          if (data.config) {
            currentConfig = data.config;
            currentThemeName = data.themeName || "vino";
            if (data.customTheme) customTheme = data.customTheme;

            document.querySelectorAll('.theme-card').forEach(card => {
              card.classList.toggle('selected', card.dataset.theme === currentThemeName);
            });
            document.getElementById('customColorsWrapper').style.display = currentThemeName === 'custom' ? 'block' : 'none';

            populateForm();
            updatePreview(true);
            showToast('Proyecto cargado exitosamente');
          } else {
            showToast('Formato de archivo JSON inválido');
          }
        } catch (err) {
          showToast('Error al leer el archivo JSON');
        }
      };
      reader.readAsText(file);
    }
  });

  // 4. Ver en nueva pestaña
  document.getElementById('btnOpenNewTab').addEventListener('click', () => {
    const decorAssets = typeof DECOR_ASSETS !== 'undefined' ? DECOR_ASSETS : {};
    const html = TemplateEngine.generateHTML(currentConfig, currentThemeName, customTheme, decorAssets);
    const newTab = window.open();
    if (newTab) {
      newTab.document.open();
      newTab.document.write(html);
      newTab.document.close();
    }
  });
}

// ==================== TOAST HELPER ====================
function showToast(message) {
  const toast = document.getElementById('appToast');
  const msgEl = document.getElementById('toastMessage');
  msgEl.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// =========================================================================
// MONITOR RSVP EN TIEMPO REAL: RECEPTOR DE CONFIRMACIONES DE INVITADOS
// =========================================================================
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INVITTA_GUEST_CONFIRMED') {
    const d = event.data;
    const icon = d.isAttending ? '🎉' : 'ℹ️';
    const statusText = d.isAttending ? `confirmó ${d.confirmedTickets} pase(s)` : 'declinó asistencia';
    showToast(`${icon} RSVP: ${d.guestName} ${statusText}`);
  }
});

