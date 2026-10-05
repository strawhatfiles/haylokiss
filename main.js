/**
 * ==========================================
 * 1. CONFIGURATION & ROUTING
 * ==========================================
 */

const tabContents = {
    'sbs': './pages/1_sbs.html',
    'cover-stories': './pages/2_cover-stories.html',
    'specials-movies': './pages/3_specials-movies.html',
    'filler': './pages/4_filler.html',
    'ops-eds': './pages/5_ops-eds.html'
};

const APP_VERSION = typeof SITE_VERSION !== 'undefined' ? SITE_VERSION : Date.now(); // Fallback

/**
 * Handles tab switching via Fetch API
 * Clears DOM early to abort pending media requests before fetching new content
 */
async function showTab(tabName) {
    const display = document.getElementById('tab-display');
    const url = tabContents[tabName];

    if (!url) return;

    // 1. Update active button state visually
    updateActiveTabUI(tabName);
    // Clear DOM immediately to force the browser to abort pending PDF network requests
    display.innerHTML = '<div style="text-align: center; padding: 3rem; color: #4ecdc4; font-style: italic;">Loading...</div>';

    // 2. Reset scroll position and header styling
    window.scrollTo({ top: 0, behavior: "instant" });
    const tabContainer = document.querySelector(".tab-container");
    if (tabContainer) tabContainer.classList.remove("scrolled");

    try {
        // 3. Fetch new HTML with cache-busting parameter
        const fetchUrl = `${url}?v=${APP_VERSION}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);

        // 4. Inject fetched HTML
        display.innerHTML = await response.text();

        // 5. Restart entry animations
        display.style.animation = "none";
        display.offsetHeight; // Trigger reflow
        display.style.animation = "fadeIn 0.5s ease-out";

        // 6. Execute tab-specific initialization logic
        if (tabName === 'cover-stories') {
            initializeCoverStories();
        } else if (tabName === 'ops-eds') {
            initializeOpsEds();
        } else if (tabName === 'filler') {
            initializeFiller();
        }

    } catch (error) {
        display.innerHTML = `<div style="padding: 20px; color: #ff6b6b; text-align: center;">Error: Page could not be loaded. Please ensure you are running on a local server.</div>`;
        console.error("Fetch error:", error);
    }
}

function updateActiveTabUI(tabName) {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) => tab.classList.remove("active"));

    // Select the button that calls showTab with this specific tabName
    const activeTab = document.querySelector(`.tab[onclick*="'${tabName}'"]`);
    if (activeTab) activeTab.classList.add("active");
}


/**
 * ==========================================
 * 2. TAB-SPECIFIC INITIALIZERS
 * ==========================================
 */

// --- COVER STORIES TAB ---
function initializeCoverStories() {
    // Set up the Intersection Observer
    const galleryObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const container = entry.target;
                const galleryId = container.id;

                // Find matching Gallery data from our new array
                const galleryData = coverStoryGalleries.find(g => g.id === galleryId);
                if (galleryData) {
                    container.innerHTML = createGalleryEmbed(galleryData);
                }

                // Stop watching this container once it loads
                observer.unobserve(container);
            }
        });
    }, {
        rootMargin: "300px 0px" // Starts loading when within 300px of the viewport
    });

    // Observe all containers
    coverStoryGalleries.forEach((gallery) => {
        const container = document.getElementById(gallery.id);
        if (container) {
            galleryObserver.observe(container);
        }
    });

    // Staggered Entry Animations
    const coverStories = document.querySelectorAll(".story-wrapper, .cover-story");
    coverStories.forEach((story, index) => {
        story.style.setProperty("--item-index", index);
        story.style.opacity = "0";
        story.style.transform = "translateY(30px) scale(0.95)";
        setTimeout(() => {
            story.style.animation = `slideInUp 0.6s ease-out forwards`;
            story.style.animationDelay = `${index * 0.1}s`;
        }, 100);
    });

    // 1. Filter out 8.5 & 9.5
    const filteredMarkers = Array.from(document.querySelectorAll('.progress-markers .marker'))
        .filter(marker => marker.dataset.number !== "8.5" && marker.dataset.number !== "9.5");

    // 2. Count the valid ones (completed + incomplete) and the strictly completed ones
    const validMarkers = filteredMarkers.filter(m => m.classList.contains('completed') || m.classList.contains('incomplete'));
    const completedMarkers = validMarkers.filter(m => m.classList.contains('completed'));

    // 3. Calculate Cover Story progress bar and update the UI
    if (validMarkers.length > 0) {
        const percentage = (completedMarkers.length / validMarkers.length) * 100;
        const progressFill = document.querySelector('.progress-fill');
        const progressLabel = document.querySelector('.progress-label');

        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressLabel) progressLabel.innerHTML = `Cover Story Progress &bull; ${completedMarkers.length} of ${validMarkers.length} Complete`;
    }
}

// --- OPS & EDS TAB ---
function initializeOpsEds() {
    injectCollapsibleCloseButtons();
}

// --- FILLER TAB ---
function initializeFiller() {
    // Only run if the ESP toggle elements exist in the loaded HTML
    const espToggles = document.querySelectorAll('.esp-toggle');
    const espItems = document.querySelectorAll('.esp-filler');
    const espCount = espItems.length;

    // 1. Inject the dynamic count (e.g., 21) into the toggle labels
    const dynamicCountLabels = document.querySelectorAll('.esp-dynamic-count');
    dynamicCountLabels.forEach(label => label.innerText = espCount);

    // 2. Read the "77" directly from the HTML text exactly ONCE and cache it invisibly
    const countDisplay = document.getElementById('total-skipped-count');
    if (countDisplay && !countDisplay.dataset.baseCount) countDisplay.dataset.baseCount = countDisplay.innerText.replace(/\D/g, '');

    if (espToggles.length > 0) {
        // Attach the event listener to BOTH toggles
        espToggles.forEach(toggle => {
            toggle.addEventListener('change', toggleESP);
        });
        // Run once to set the initial text state and math
        toggleESP({ target: espToggles[0] });
    }

    injectCollapsibleCloseButtons();
}

function toggleESP(e) {
    const isChecked = e && e.target ? e.target.checked : false;
    const espItems = document.querySelectorAll('.esp-filler');
    const espCount = espItems.length;

    // Sync all toggles on the page
    const espToggles = document.querySelectorAll('.esp-toggle');
    espToggles.forEach(toggle => toggle.checked = isChecked);

    const countDisplay = document.getElementById('total-skipped-count');
    const countDesc = document.getElementById('total-skipped-desc');

    // Read the base count we secretly saved during initializeFiller
    const baseCount = countDisplay && countDisplay.dataset.baseCount ? parseInt(countDisplay.dataset.baseCount) : 0;
    const totalWithESP = baseCount + espCount;

    espItems.forEach(item => {
        item.style.display = isChecked ? 'block' : 'none';
    });

    if (countDisplay && countDesc) {
        if (isChecked) {
            countDisplay.innerText = `= ${totalWithESP}`;
            countDesc.innerHTML = `${totalWithESP} yet-to-watch filler episode count <u>includes</u> the ${espCount} E-SP recap summary episodes`;
        } else {
            countDisplay.innerText = `= ${baseCount}`;
            countDesc.innerHTML = `${baseCount} yet-to-watch filler episode count does <u>not</u> include the ${espCount} E-SP recap summary episodes`;
        }
    }
}


/**
 * ==========================================
 * 3. PDF HANDLING LOGIC
 * ==========================================
 */

function createGalleryEmbed(galleryData) {
    return `
        <div style="position: relative; width: 100%; height: 100%; cursor: pointer; overflow: hidden; border-radius: 10px;" 
             onclick="openCoverStoryGallery('${galleryData.id}')"
             onmouseover="this.querySelector('.gallery-indicator').style.transform='scale(1.15)'; this.querySelector('.gallery-indicator').style.background='rgba(78, 205, 196, 0.9)'; this.querySelector('.gallery-indicator').style.color='white';"
             onmouseout="this.querySelector('.gallery-indicator').style.transform='scale(1)'; this.querySelector('.gallery-indicator').style.background='rgba(0, 0, 0, 0.7)'; this.querySelector('.gallery-indicator').style.color='#4ecdc4';">
             
            <img src="${galleryData.thumbnail}?v=${APP_VERSION}" 
                 style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" 
                 alt="${galleryData.title.replace(/"/g, '&quot;').replace(/'/g, '&#39;')} Preview" />
                 
            <div class="gallery-indicator" style="position: absolute; bottom: 8px; right: 8px; width: 28px; height: 28px; background: rgba(0, 0, 0, 0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #4ecdc4; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(5px); border: 1px solid rgba(78, 205, 196, 0.5); box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                </svg>
            </div>
            
        </div>
    `;
}

/**
function createPDFEmbed(pdfPath, pdfId, driveUrl) {
    const isPlaceholder = driveUrl.includes('/yo/preview');

    const supportsPDF = (function () {
        const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileBrowser = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);

        let hasPDFSupport;
        try {
            hasPDFSupport = navigator.pdfViewerEnabled || (navigator.plugins && Array.from(navigator.plugins).some((plugin) => plugin.name.toLowerCase().includes("pdf")));
        } catch (e) {
            hasPDFSupport = false;
        }

        return !isTouchDevice && !isSmallScreen && !isMobileBrowser && hasPDFSupport;
    })();

    if (isPlaceholder) {
        return `
            <div class="pdf-placeholder" id="placeholder-${pdfId}" style="opacity: 0.5; cursor: not-allowed;">
                <div class="load-button" style="pointer-events: none;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.5;">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span style="opacity: 0.5;">Not Available Yet</span>
                </div>
            </div>
        `;
    }

    if (supportsPDF) {
        return `
            <div style="position: relative; width: 100%; height: 100%;">
                <object data="${pdfPath}#view=Fit" type="application/pdf"
                        style="width: 160%; height: 100%; margin-left: -30%; border: none;">
                    <div class="pdf-placeholder" id="placeholder-${pdfId}">
                        <div class="load-button" onclick="loadPDF('placeholder-${pdfId}', '${driveUrl}')">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            <span>Error</span>
                        </div>
                    </div>
                </object>
                <button onclick="window.open('${pdfPath}', '_blank')"
                        style="position: absolute; top: 50%; right: 8px; transform: translateY(-50%); background: rgba(0, 0, 0, 0.7); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(5px); z-index: 10;"
                        onmouseover="this.style.background='rgba(255, 107, 107, 0.9)'; this.style.transform='translateY(-50%) scale(1.1)'"
                        onmouseout="this.style.background='rgba(0, 0, 0, 0.7)'; this.style.transform='translateY(-50%) scale(1)'"
                        title="Open in new tab">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        return `
            <div class="pdf-placeholder" id="placeholder-${pdfId}">
                <div class="load-button" onclick="loadPDF('placeholder-${pdfId}', '${driveUrl}')">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>Load PDF</span>
                </div>
            </div>
        `;
    }
}

function loadPDF(placeholderId, pdfUrl) {
    const versionedUrl = `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}v=${APP_VERSION}`;
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
        placeholder.innerHTML = `<iframe src="${versionedUrl}" allow="autoplay" style="width: 100%; height: 100%; border: none;"></iframe>`;
        placeholder.classList.remove("pdf-placeholder");
    }
}

function loadAllPDFs() {
    const unloadedPlaceholders = document.querySelectorAll('.pdf-placeholder .load-button[onclick*="loadPDF"]');
    if (unloadedPlaceholders.length === 0) return;

    const button = document.getElementById("loadAllBtn");
    if (!button) return;

    const container = document.querySelector(".load-all-container");
    button.disabled = true;
    button.classList.add("loading");
    button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg> Loading...';

    // Dynamically extract pending Drive URLs
    Array.from(unloadedPlaceholders).forEach((btn, index) => {
        const onClickAttr = btn.getAttribute('onclick');
        // Extract parameters from onclick="loadPDF('placeholder-x', 'url')"
        const match = onClickAttr.match(/loadPDF\('([^']+)',\s*'([^']+)'\)/);
        if (match) {
            setTimeout(() => {
                loadPDF(match[1], match[2]);

                // Hide container when finished
                if (index === unloadedPlaceholders.length - 1) {
                    button.classList.remove("loading");
                    setTimeout(() => {
                        container.style.transition = "opacity 0.5s ease-out, transform 0.5s ease-out";
                        container.style.opacity = "0";
                        container.style.transform = "translateY(-20px)";
                        setTimeout(() => container.style.display = "none", 500);
                    }, 500);
                }
            }, index * 200);
        }
    });
}

function updateLoadAllButton() {
    const placeholders = document.querySelectorAll('.pdf-placeholder .load-button[onclick]');
    const drivePlaceholders = Array.from(placeholders).filter(el => {
        const onclick = el.getAttribute("onclick");
        return onclick && onclick.includes("drive.google.com") && el.offsetParent !== null;
    });

    const loadAllContainer = document.getElementById("mobileLoadAllContainer");
    if (loadAllContainer) {
        loadAllContainer.style.display = drivePlaceholders.length > 0 ? "block" : "none";
    }
}
*/


/**
 * ==========================================
 * 4. UI INTERACTION HELPERS
 * ==========================================
 */

function toggleSpoiler(element) {
    element.classList.toggle("revealed");
}

function toggleCollapsible(sectionId) {
    const content = document.getElementById(sectionId + '-content');
    const toggle = document.getElementById(sectionId + '-toggle');

    if (!content || !toggle) return;

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.innerHTML = '+';
        toggle.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('expanded');
        toggle.innerHTML = '−';
        toggle.style.transform = 'rotate(180deg)';
    }
}

function injectCollapsibleCloseButtons() {
    const collapsibles = document.querySelectorAll('.collapsible-section');

    collapsibles.forEach(section => {
        const inner = section.querySelector('.collapsible-content-inner');
        const content = section.querySelector('.collapsible-content');
        const header = section.querySelector('.collapsible-header');

        // Prevent duplicate injections if tab is re-opened
        if (inner && content && header && !inner.querySelector('.collapse-bottom-wrapper')) {
            const sectionId = content.id.replace('-content', '');

            const wrapper = document.createElement('div');
            wrapper.className = 'collapse-bottom-wrapper';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn btn-secondary collapse-bottom-btn';
            closeBtn.style.marginTop = "2rem";
            closeBtn.style.display = "flex";
            closeBtn.style.gap = "0.5rem";
            closeBtn.style.alignItems = "center";
            closeBtn.style.marginInline = "auto";
            closeBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m18 15-6-6-6 6"/>
                </svg>
                Close Section
            `;

            closeBtn.onclick = function() {
                toggleCollapsible(sectionId);
                setTimeout(() => {
                    header.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
            };

            wrapper.appendChild(closeBtn);
            inner.appendChild(wrapper);
        }
    });
}

function openLightbox(imageSrc) {
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const galleryUI = document.getElementById("gallery-ui");
    if (!lightbox || !lightboxImg) return;

    // HIDE gallery elements & disable clicking the image to go forward
    if(galleryUI) galleryUI.style.display = "none";
    lightboxImg.onclick = function(e) { e.stopPropagation(); };
    lightboxImg.style.cursor = "default";

    lightboxImg.src = imageSrc;
    const filename = imageSrc.split("/").pop();
    lightboxImg.alt = filename
        .replace(/\.(webp|jpg|jpeg|png|gif)$/i, "")
        .replace(/^\d+\s*-\s*/, "")
        .replace(/[-_]/g, " ")
        .trim();
    lightbox.style.display = "block";
    resetLightboxIdleTimer();
}

let lightboxLoadToken = 0;
let currentGalleryImages = [];
let currentBaseCount = 0;
let currentExtraCount = 0;
let currentSideCount = 0;
let galleryManifest = {};
let currentGalleryIndex = 0;
let currentActiveGallery = null;
let isColoredMode = true;
let spreadsInCoverStories = false; // Default state (cover requests)

function toggleGalleryMode(e) {
    spreadsInCoverStories = !e.target.checked;
    
    const storyLabel = document.getElementById("mode-story-label");
    const requestLabel = document.getElementById("mode-request-label");

    if (spreadsInCoverStories) {
        storyLabel.style.color = "#4ecdc4"; 
        requestLabel.style.color = "#666";
    } else {
        storyLabel.style.color = "#666";
        requestLabel.style.color = "#ffc107"; 
    }
}

function openCoverStoryGallery(galleryId) {
    currentActiveGallery = coverStoryGalleries.find(g => g.id === galleryId);
    if (!currentActiveGallery) return;
    currentGalleryIndex = 0;

    // SHOW gallery elements & re-enable clicking the image to advance
    const galleryUI = document.getElementById("gallery-ui");
    if(galleryUI) galleryUI.style.display = "block";

    const lightboxImg = document.getElementById("lightbox-img");
    if (lightboxImg) {
        lightboxImg.onclick = function(e) { navigateGallery(1); e.stopPropagation(); };
        lightboxImg.style.cursor = "e-resize";
    }

    // Sync the toggle switch with our global state before showing
    const toggleCheckbox = document.getElementById("color-toggle-checkbox");
    if (toggleCheckbox) toggleCheckbox.checked = isColoredMode;

    generateGalleryImages();
    updateLightboxImage();
    updateColorToggleUI();

    document.getElementById("lightbox").style.display = "block";
    document.addEventListener("keydown", handleGalleryKeyboard);
    resetLightboxIdleTimer();
}

function generateGalleryImages() {
    if (!currentActiveGallery) return;

    currentGalleryImages = [];
    currentBaseCount = 0;
    currentExtraCount = 0;
    currentSideCount = 0;

    const isStoryMode = currentActiveGallery.type === "story";

    // 1. Build the path array
    let pathsToRead = [currentActiveGallery.folder];

    if (isStoryMode && spreadsInCoverStories && currentActiveGallery.altFolder) {
        pathsToRead.push(currentActiveGallery.altFolder);
    }

    // 2. Process the folders
    pathsToRead.forEach(folderPath => {
        let activePath = folderPath;
        if (!isColoredMode) {
            activePath = activePath.replace("Colored-Cover-Stories", "Cover-Stories");
        }

        const safePath = activePath.replace(/#/g, '%23');
        let availableFiles = galleryManifest[activePath] || [];
        
        // Setup B: Define the locked array FIRST so we can use it below
        let activeLocked = currentActiveGallery.locked || [];
        if (!isStoryMode) {
            const parentId = currentActiveGallery.id.split('.')[0]; // Turns "pdf-15.5" into "pdf-15"
            const parentGallery = coverStoryGalleries.find(g => g.id === parentId);
            if (parentGallery && parentGallery.locked) {
                activeLocked = parentGallery.locked;
            }
        }

        // Setup A: Find what files to replace, but IGNORE them if they are locked
        const editedBaseNames = availableFiles
            .filter(f => {
                const baseName = f.replace(/\.(png|jpg)$/, '');
                
                // If you put "17+TL" in the locked array, this stops it from acting as a replacement
                if (activeLocked.includes(baseName)) {
                    return false; 
                }
                
                return f.includes('-edited') || f.includes('+TL');
            })
            .map(f => {
                const base = f.replace(/\.(png|jpg)$/, '');
                if (base.includes('-edited')) return base.split('-edited')[0];
                if (base.includes('+TL')) return base.split('+TL')[0];
                return base;
            });

        availableFiles = availableFiles.filter(fileName => {
            const baseName = fileName.replace(/\.(png|jpg)$/, '');

            // RULE 1: Is it manually locked in the HTML? Hide it.
            if (activeLocked && activeLocked.length > 0) {
                // A. Direct Match (Hides the exact file you listed, e.g. "15-extra...")
                if (activeLocked.includes(baseName)) return false;

                // B. Twin Match (Protects regular spreads, ONLY targets movie spreads)
                if (baseName.includes('-colorspread') && baseName.includes('movie')) {
                    // Extracts the "15" from "691-colorspread_15_(movie-12-film-z)"
                    const spreadNum = baseName.split(/-colorspread\d*_/)[1].split(/[-_+]/)[0]; 
                    
                    // Checks if you locked the corresponding extra version (supports old & new naming)
                    const isTwinLocked = activeLocked.some(lockItem => 
                        (lockItem.startsWith(`${spreadNum}-extra`) || lockItem.startsWith(`${spreadNum}_`)) 
                        && lockItem.includes('-extra') 
                        && lockItem.includes('movie')
                    );
                    
                    if (isTwinLocked) return false;
                }
            }

            // RULE 2: Is it a movie extra, and are we in Story Mode WITH Spreads active? Ensure we ONLY hide the original, not copy.
            if (isStoryMode && spreadsInCoverStories && baseName.includes('movie') && !baseName.includes('-colorspread_')) {
                return false;
            }

            // RULE 3: Does an edited/TL version exist for this exact base name? Hide this original.
            if (editedBaseNames.includes(baseName)) {
                return false;
            }

            // RULE 4: Hide manual _blurred.png files from the main loop so they aren't duplicates
            if (baseName.includes('_blurred')) {
                return false;
            }

            return true; 
        });

        availableFiles.forEach(fileName => {
            const baseName = fileName.replace(/\.(png|jpg)$/, '');
            const isSpread = baseName.includes('-colorspread');
            const isVolume = baseName.includes('-volume');
            const isExtra = baseName.includes('-extra');
            const isSide = baseName.includes('-side');
            const soonToBeGone = baseName.endsWith('-DELETE');

            // --- CHAPTER NUMBER EXTRACTION ---
            let extractedChapter = null;

            // This turns "38_474-extra(ep418-ch523)" into just "38_474-extra"
            let cleanBase = baseName.replace(/\([^)]*\)/g, '');
            
            if (isSpread) {
                extractedChapter = parseFloat(cleanBase.split(/-colorspread\d*_/)[0]);
            } else if (isVolume) {
                extractedChapter = parseFloat(cleanBase.split('-volume')[0]);
            } else {
                // Strip out '-extra1', '-side2', etc. before searching for the chapter number
                let strippedBase = cleanBase.replace(/-(extra|side)\d*/g, '');
                
                // Ultimate Regex: Finds the last number behind an underscore/dash, 
                // ignores text like "ch", and safely ignores trailing tags like "+TL"
                const match = strippedBase.match(/[-_][A-Za-z]*(\d+)(?:\D*)$/);
                if (match) {
                    extractedChapter = parseFloat(match[1]);
                } else {
                    // NEW FALLBACK: For regular pages like "732.png", just grab the number at the front!
                    extractedChapter = parseFloat(cleanBase.split(/[-_+]/)[0]);
                }
            }

            // --- CENSORSHIP LOGIC ---
            let useManualBlur = false;
            let useAutoBlur = false;
            let currentBlurConfig = { direction: "top", amount: 100 }; // Default config object

            // Determine whether to pull data from the main gallery or the parent gallery
            let sourceGallery = currentActiveGallery;
            if (!isStoryMode) {
                const parentId = currentActiveGallery.id.split('.')[0]; 
                const parentGallery = coverStoryGalleries.find(g => g.id === parentId);
                if (parentGallery) sourceGallery = parentGallery;
            }

            // Select the appropriate censor configuration
            let activeCensor = null;
            if (!isColoredMode && sourceGallery.autoCensorBW) {
                activeCensor = sourceGallery.autoCensorBW;
            } else if (sourceGallery.autoCensor) {
                activeCensor = sourceGallery.autoCensor;
            }

            if (activeCensor) {
                const manualList = activeCensor.manualList || [];
                const fileNum = parseFloat(baseName.split(/[-_+]/)[0]); 
                const isChapterRequest = !isStoryMode || folderPath === currentActiveGallery.altFolder;

                // 1. Color Spreads & Volumes
                if ((isSpread || isVolume) && activeCensor.coverPages && activeCensor.coverPages.afterChapter !== undefined) {
                    const chapterNum = isVolume ? parseFloat(baseName.split('-volume')[0]) : parseFloat(baseName.split(/-colorspread\d*_/)[0]);
                    if (chapterNum > activeCensor.coverPages.afterChapter) {
                        if (manualList.some(lockItem => baseName.includes(lockItem))) {
                            useManualBlur = true; 
                        } else {
                            useAutoBlur = true;
                            let targetConfig = { direction: "top", amount: activeCensor.coverPages.spreadBlurHeight || 100 };

                            if (activeCensor.coverPages.spreadBlurHeightExceptions) {
                                for (const [rule, fileArray] of Object.entries(activeCensor.coverPages.spreadBlurHeightExceptions)) {
                                    if (fileArray.some(item => baseName.includes(item))) {
                                        if (rule.includes(':')) {
                                            const parts = rule.split(':');
                                            targetConfig = { direction: parts[0].trim(), amount: parseFloat(parts[1]) };
                                        } else {
                                            targetConfig.amount = parseFloat(rule);
                                        }
                                        break;
                                    }
                                }
                            }
                            currentBlurConfig = targetConfig;
                        }
                    }
                }
                
                // 2. Regular Story Pages & Chapter Requests
                else if (!isSpread && !isVolume) {
                    let shouldCensor = false;
                    let targetConfig = { direction: "top", amount: 100 };
                    let exceptionsToCheck = null;

                    if (!isChapterRequest && activeCensor.coverStories && activeCensor.coverStories.afterPage !== undefined) {
                        if (fileNum > activeCensor.coverStories.afterPage) {
                            shouldCensor = true;
                            targetConfig.amount = activeCensor.coverStories.blurHeight || 100;
                            exceptionsToCheck = activeCensor.coverStories.blurHeightExceptions;
                        }
                    }
                    else if (isChapterRequest && activeCensor.coverPages && activeCensor.coverPages.afterChapter !== undefined) {
                        if (fileNum > activeCensor.coverPages.afterChapter) {
                            shouldCensor = true;
                            targetConfig.amount = activeCensor.coverPages.blurHeight || 100;
                            exceptionsToCheck = activeCensor.coverPages.blurHeightExceptions;
                        }
                    }

                    if (shouldCensor) {
                        if (manualList.some(lockItem => baseName.includes(lockItem))) {
                            useManualBlur = true;
                        } else {
                            useAutoBlur = true;
                            if (exceptionsToCheck) {
                                for (const [rule, fileArray] of Object.entries(exceptionsToCheck)) {
                                    if (fileArray.some(item => baseName.includes(item))) {
                                        // Parses rules like "bottom: 25" into direction and amount
                                        if (rule.includes(':')) {
                                            const parts = rule.split(':');
                                            targetConfig = { direction: parts[0].trim(), amount: parseFloat(parts[1]) };
                                        } else {
                                            targetConfig.amount = parseFloat(rule);
                                        }
                                        break;
                                    }
                                }
                            }
                            currentBlurConfig = targetConfig;
                        }
                    }
                }
            }

            // 3. Finalize the Source URL
            let finalSrc = `${safePath}${fileName}?v=${APP_VERSION}`;
            if (useManualBlur) {
                const blurredFileName = fileName.replace(/\.(png|jpg)$/, '_blurred.$1');
                finalSrc = `${safePath}${blurredFileName}?v=${APP_VERSION}`;
            }

            if (isStoryMode) {
                // --- COVER STORY gallery ---
                if ((isSpread || isVolume) && spreadsInCoverStories && folderPath === currentActiveGallery.altFolder) {
                    let pagePart, volNum = null;
                    if (isVolume) {
                        const volPart = baseName.split('-volume')[1];
                        volNum = volPart.split(/[-_+]/)[0];
                        // Allows "890-volume89_35" to parse as page 35, otherwise defaults to 890
                        pagePart = volPart.includes('_') ? volPart.split('_')[1] : baseName.split('-volume')[0];
                    } else {
                        pagePart = baseName.split(/-colorspread\d*_/)[1];
                    }
                    
                    currentGalleryImages.push({
                        src: finalSrc,
                        displayNum: ``, 
                        sortKey: parseFloat(pagePart.split(/[-_+]/)[0]),
                        isSpreadFlag: isSpread,
                        isVolumeFlag: isVolume,
                        pageNum: pagePart.split(/[-_+]/)[0],
                        volNum: volNum,
                        requiresAutoBlur: useAutoBlur,
                        blurConfig: currentBlurConfig,
                        chapterNum: extractedChapter
                    });
                } else if (!isSpread && !isVolume && folderPath !== currentActiveGallery.altFolder) {
                    if (isExtra) currentExtraCount++;
                    else if (isSide) currentSideCount++;
                    else currentBaseCount++;

                    const pageNum = baseName.split(/[-_+]/)[0];
                    
                    currentGalleryImages.push({
                        src: finalSrc,
                        displayNum: ``,
                        sortKey: parseFloat(baseName),
                        isSpreadFlag: false,
                        isVolumeFlag: false,
                        isExtra: isExtra,
                        isSide: isSide,
                        pageNum: pageNum,
                        requiresAutoBlur: useAutoBlur,
                        blurConfig: currentBlurConfig,
                        chapterNum: extractedChapter
                    });
                }
            } else {
                // --- COVER REQUEST gallery ---
                if (isSpread || isVolume) {
                    if (!spreadsInCoverStories) {
                        const chapterPart = isVolume ? baseName.split('-volume')[0] : baseName.split(/-colorspread\d*_/)[0];
                        let volNum = null;
                        if (isVolume) volNum = baseName.split('-volume')[1].split(/[-_+]/)[0];

                        currentGalleryImages.push({
                            src: finalSrc,
                            displayNum: ``, 
                            sortKey: parseFloat(chapterPart),
                            isSpreadFlag: isSpread,
                            isVolumeFlag: isVolume,
                            volNum: volNum,
                            requiresAutoBlur: useAutoBlur,
                            blurConfig: currentBlurConfig,
                            chapterNum: extractedChapter
                        });
                    }
                } else {
                    if (!soonToBeGone) currentBaseCount++;
                    currentGalleryImages.push({
                        src: finalSrc,
                        displayNum: ``, 
                        sortKey: parseFloat(baseName),
                        isSpreadFlag: false,
                        isVolumeFlag: false,
                        soonToBeGone: soonToBeGone,
                        requiresAutoBlur: useAutoBlur,
                        blurConfig: currentBlurConfig,
                        chapterNum: extractedChapter
                    });
                }
            }
        });
    });

    // 2. SORT THE ARRAY
    currentGalleryImages.sort((a, b) => {
        /* Pushes all Color Spreads and Volume covers to the END of the Request Gallery
        if (!isStoryMode) {
            const aIsBonus = a.isSpreadFlag || a.isVolumeFlag;
            const bIsBonus = b.isSpreadFlag || b.isVolumeFlag;
            
            if (aIsBonus !== bIsBonus) {
                return aIsBonus ? 1 : -1; // Standard pages come first, bonus items at the end
            }
        }*/

        // 1st Priority: Sort by the primary sortKey (Page Number for Story, Chapter Number for Requests)
        if (a.sortKey !== b.sortKey) {
            return a.sortKey - b.sortKey;
        }

        // 2nd Priority: If page numbers tie (Story Mode), sort by chronological Chapter Number
        if (a.chapterNum && b.chapterNum && a.chapterNum !== b.chapterNum) {
            return a.chapterNum - b.chapterNum;
        }

        // Helper function to establish absolute priority when numbers tie AND chapters tie
        // Order: 1=Base, 2=Side, 3=Extra, 4=Volume, 5=Color Spread
        const getRank = (img) => {
            if (img.isSide) return 2;
            if (img.isExtra) return 3;
            if (img.isVolumeFlag) return 4;
            if (img.isSpreadFlag) return 5;
            return 1; 
        };

        const rankA = getRank(a);
        const rankB = getRank(b);

        // 3rd Priority: Sort by the established Rank
        if (rankA !== rankB) {
            return rankA - rankB;
        }

        // 4th Priority (Tie Breaker): If types are completely identical, sort alphabetically
        return a.src.localeCompare(b.src);
    });

    // 3. SECOND PASS: Dynamically count spreads, request pages, extras, and sides
    let spreadCounter = 0;
    let requestPageCounter = 0;
    let extraCounter = 0;
    let sideCounter = 0;

    currentGalleryImages.forEach(img => {
        if (img.isSpreadFlag || img.isVolumeFlag) {
            if (img.isVolumeFlag) {
                if (isStoryMode) {
                    // Story Mode Volumes
                    img.displayNum = `Page ${img.pageNum} (Vol. ${img.volNum})`;
                } else {
                    // Request Mode Volumes
                    img.displayNum = `(Ch. ${img.chapterNum}) Vol. ${img.volNum}`;
                }
            } else if (img.isSpreadFlag) {
                spreadCounter++; 
                
                if (isStoryMode) {
                    img.displayNum = `Page ${img.pageNum} (Spread ${spreadCounter})`;
                } else {
                    // Request Mode Spreads
                    const formattedSpread = String(spreadCounter).padStart(2, '0');
                    img.displayNum = `(Ch. ${img.chapterNum}) Spread ${formattedSpread}`;
                }
            }
        } else {
            if (isStoryMode) {
                // Story Mode Standard, Extra & Side Pages
                if (img.isExtra) {
                    extraCounter++;
                    img.displayNum = `Page ${img.pageNum} (Extra ${extraCounter})`;
                } else if (img.isSide) {
                    sideCounter++;
                    img.displayNum = `Page ${img.pageNum} (Side ${sideCounter})`;
                } else {
                    img.displayNum = `Page ${img.pageNum}`;
                }
            } else {
                if (img.soonToBeGone) {
                    // Request Mode Title Pages (Skips counter, Chapter only)
                    img.displayNum = `(Ch. ${img.chapterNum})`;
                } else {
                    // Request Mode Standard Pages (Chapter first, padded page)
                    requestPageCounter++;
                    const formattedPage = String(requestPageCounter).padStart(2, '0');
                    img.displayNum = `(Ch. ${img.chapterNum}) Page ${formattedPage}`;
                }
            }
        }
    });

    // 4. Build Custom Dropdown UI
    const customDropdown = document.getElementById("custom-page-dropdown");
    if (customDropdown) {
        customDropdown.innerHTML = "";
        currentGalleryImages.forEach((img, index) => {
            const item = document.createElement("div");
            item.className = "custom-dropdown-item";
            item.innerText = img.displayNum;
            item.onclick = (e) => {
                e.stopPropagation();
                jumpToGalleryPage(index);
                toggleCustomDropdown();
            };
            customDropdown.appendChild(item);
        });
    }
}

function toggleCustomDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("custom-page-dropdown");
    if (dropdown) dropdown.classList.toggle("show");
}

function jumpToGalleryPage(index) {
    currentGalleryIndex = parseInt(index);
    updateLightboxImage();
}

function toggleColorMode(e) {
    if (e) e.stopPropagation();
    // Grab the true/false state directly from the new switch toggle
    const toggleCheckbox = document.getElementById("color-toggle-checkbox");
    if (toggleCheckbox) {
        isColoredMode = toggleCheckbox.checked;
    }
    generateGalleryImages();
    updateLightboxImage();
    updateColorToggleUI();
}

function updateColorToggleUI() {
    const label = document.querySelector(".color-toggle-label");
    const wrapper = document.querySelector(".color-toggle-wrapper");

    if (label && wrapper) {
        if (isColoredMode) {
            label.innerText = "COLORED";
            label.style.color = "#4ecdc4";
            wrapper.style.borderColor = "rgba(78, 205, 196, 0.3)";
        } else {
            label.innerText = "ORIGINAL";
            label.style.color = "#d0d0d0";
            wrapper.style.borderColor = "rgba(208, 208, 208, 0.3)";
        }
    }
}

function updateLightboxImage() {
    const lightboxImg = document.getElementById("lightbox-img");
    const display = document.getElementById("lightbox-page-display");

    if (lightboxImg && currentGalleryImages.length > 0) {
        const currentItem = currentGalleryImages[currentGalleryIndex];
        
        // --- NEW: Generate a unique token for this specific click ---
        lightboxLoadToken++;
        const myToken = lightboxLoadToken;

        // --- NEW: Grab the wrapper so we can fade the image and censor bar TOGETHER ---
        const wrapper = lightboxImg.parentElement;

        // 1. INSTANTLY hide the entire wrapper
        wrapper.style.transition = "none";
        wrapper.style.opacity = "0";
        void wrapper.offsetHeight; // Force the browser to apply this immediately

        // 2. Set up the Censor Bar while the wrapper is completely hidden
        const censorBar = document.getElementById("auto-censor-bar");
        if (censorBar) {
            if (currentItem.requiresAutoBlur) {
                censorBar.style.display = "block";
                const config = currentItem.blurConfig;

                // Reset all CSS properties
                censorBar.style.top = "auto";
                censorBar.style.bottom = "auto";
                censorBar.style.left = "auto";
                censorBar.style.right = "auto";
                censorBar.style.width = "100%";
                censorBar.style.height = "100%";

                // Apply dynamic dimensions
                if (config.direction === "top") {
                    censorBar.style.top = "0";
                    censorBar.style.left = "0";
                    censorBar.style.height = `${config.amount}%`;
                } else if (config.direction === "bottom") {
                    censorBar.style.bottom = "0";
                    censorBar.style.left = "0";
                    censorBar.style.height = `${config.amount}%`;
                } else if (config.direction === "left") {
                    censorBar.style.top = "0";
                    censorBar.style.left = "0";
                    censorBar.style.width = `${config.amount}%`;
                } else if (config.direction === "right") {
                    censorBar.style.top = "0";
                    censorBar.style.right = "0";
                    censorBar.style.width = `${config.amount}%`;
                }
            } else {
                censorBar.style.display = "none";
            }
        }

        // 3. Attach onload BEFORE changing the source
        lightboxImg.onload = () => {
            // --- NEW: If the user spammed next, ignore this old image! ---
            if (myToken !== lightboxLoadToken) return;

            // Turn the smooth transition back on and fade the wrapper in
            wrapper.style.transition = "opacity 0.2s ease-in";
            wrapper.style.opacity = "1";
        };

        // 4. Change the source
        lightboxImg.src = currentItem.src;

        // 5. Update the counter text
        if (display) {
            // Check if the current image is a color spread OR a title page OR a volume cover
            if (currentItem.isSpreadFlag || currentItem.soonToBeGone || currentItem.isVolumeFlag) {
                display.innerText = currentItem.displayNum;
            } else {
                // Combine extras and sides for the (+X) total display
                let totalBonusCount = currentExtraCount + currentSideCount;
                
                // Add leading zero if the base count is less than 10
                let paddedBaseCount = String(currentBaseCount).padStart(2, '0');
                
                let totalDisplay = totalBonusCount > 0 
                    ? `${paddedBaseCount} (+${totalBonusCount})` 
                    : `${paddedBaseCount}`;
                display.innerText = `${currentItem.displayNum} / ${totalDisplay}`;
            }
        }

        const dropdownItems = document.querySelectorAll(".custom-dropdown-item");
        dropdownItems.forEach((item, idx) => {
            if (idx === currentGalleryIndex) {
                item.classList.add("active");
                item.scrollIntoView({ block: "nearest" });
            } else {
                item.classList.remove("active");
            }
        });
    } else {
        if (lightboxImg) {
            lightboxImg.removeAttribute('src'); 
            lightboxImg.alt = "No images currently available."; 
            lightboxImg.parentElement.style.opacity = "1"; // Reset visibility just in case
        }
        if (display) {
            display.innerText = "0 / 0"; 
        }
    }
}

function navigateGallery(direction) {
    currentGalleryIndex += direction;
    // Loop around if out of bounds
    if (currentGalleryIndex < 0) {
        currentGalleryIndex = currentGalleryImages.length - 1;
    } else if (currentGalleryIndex >= currentGalleryImages.length) {
        currentGalleryIndex = 0;
    }
    updateLightboxImage();
}

function handleGalleryKeyboard(e) {
    if (e.key === "ArrowRight") navigateGallery(1);
    if (e.key === "ArrowLeft") navigateGallery(-1);
    if (e.key === "Escape") closeLightbox();
}

function toggleFullscreen() {
    const lightbox = document.getElementById("lightbox");
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        // Enter Fullscreen
        if (lightbox.requestFullscreen) {
            lightbox.requestFullscreen();
        } else if (lightbox.webkitRequestFullscreen) {
            lightbox.webkitRequestFullscreen();
        }
    } else {
        // Exit Fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function closeLightbox() {
    const lightbox = document.getElementById("lightbox");
    if (lightbox) lightbox.style.display = "none";
    // Clean up gallery keyboard listeners so they don't fire in the background
    document.removeEventListener("keydown", handleGalleryKeyboard);
    // NEW: Exit fullscreen automatically if it's active when closing
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

document.addEventListener("click", function (e) {
    // Hide dropdown
    const dropdown = document.getElementById("custom-page-dropdown");
    if (dropdown && dropdown.classList.contains("show")) {
        dropdown.classList.remove("show");
    }
    // Close lightbox logic
    if (e.target.id === "lightbox" || e.target.id === "lightbox-img") {
        closeLightbox();
    }
});


/**
 * ==========================================
 * 5. SCROLL & GLOBAL EVENTS
 * ==========================================
 */

const scrollBtn = document.getElementById("scrollToggle");
const scrollIcon = document.getElementById("scrollIcon");

function updateScrollButton() {
    if (!scrollBtn || !scrollIcon) return;
    const scrolled = window.scrollY;
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;

    if (scrolled > 300) {
        scrollBtn.style.display = "block";
        // Only change the icon graphic here
        if (nearBottom) {
            scrollIcon.innerHTML = '<path d="m18 15-6-6-6 6"/>';
        } else {
            scrollIcon.innerHTML = '<path d="m6 9 6 6 6-6"/>';
        }
    } else {
        scrollBtn.style.display = "none";
    }
}

function updateTabContainer() {
    const tabContainer = document.querySelector(".tab-container");
    if (!tabContainer) return;

    const scrollY = window.scrollY;
    if (scrollY <= 100) {
        tabContainer.classList.remove("scrolled");
    } else if (scrollY >= 400) {
        tabContainer.classList.add("scrolled");
    }
}

// Optimized Scroll Events
let isTicking = false;
window.addEventListener("scroll", function () {
    if (!isTicking) {
        window.requestAnimationFrame(function () {
            updateScrollButton();
            updateTabContainer();
            isTicking = false;
        });
        isTicking = true;
    }
});

// Typewriter Effect
function typeWriter(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

/**
 * ==========================================
 * AUTO-HIDE LIGHTBOX UI LOGIC
 * ==========================================
 */
let lightboxIdleTimer;

function resetLightboxIdleTimer() {
    const lightbox = document.getElementById("lightbox");
    
    // If the lightbox doesn't exist or is currently closed, do nothing.
    if (!lightbox || lightbox.style.display === "none" || lightbox.style.display === "") {
        return;
    }

    // Wake up the UI and bring back the mouse cursor
    lightbox.classList.remove("ui-hidden");
    clearTimeout(lightboxIdleTimer);

    // Set timer to go back to sleep after 2.5 seconds
    lightboxIdleTimer = setTimeout(() => {
        // Prevent hiding if the custom page dropdown is currently open
        const dropdown = document.getElementById("custom-page-dropdown");
        if (dropdown && dropdown.classList.contains("show")) return;
        
        lightbox.classList.add("ui-hidden");
    }, 2000);
}

document.addEventListener("mousemove", resetLightboxIdleTimer);
document.addEventListener("mousedown", resetLightboxIdleTimer);
document.addEventListener("touchstart", resetLightboxIdleTimer);
document.addEventListener("keydown", resetLightboxIdleTimer);


/**
 * ==========================================
 * 6. INITIALIZATION ON LOAD
 * ==========================================
 */

async function initializeApp() {
    // 1. Run global UI triggers
    const header = document.querySelector('h1');
    if (header) {
        const originalText = header.textContent;
        typeWriter(header, originalText, 80);
    }

    // Fetch the automated manifest
    try {
        const response = await fetch(`./manifest.json?v=${APP_VERSION}`);
        if (response.ok) {
            galleryManifest = await response.json();
            console.log("Manifest loaded successfully!", galleryManifest);
        }
    } catch (error) {
        console.error("Failed to load image manifest:", error);
    }

    updateScrollButton();

    // Calculate the direction ONLY when the button is actually clicked
    if (scrollBtn) {
        scrollBtn.addEventListener("click", () => {
            const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
            if (nearBottom) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            }
        });
    }

    // 2. Default tab
    await showTab('cover-stories');
}

if (document.readyState === "loading") {
    // The browser is still building the page, wait for the signal
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    // The browser is already done, run it immediately!
    initializeApp();
}
