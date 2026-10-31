/* SY Delusha · Guest Voyage Companion — Preset Ports, Rich Curated Data, & Artwork Generators */

(function () {
  'use strict';

  // Generate SVG data-URLs for maritime photography & crew portraits so the app works 100% offline with zero broken links
  function makeSceneSvg(title, subtitle, skyTop, skyBottom, seaColor, accentColor, isYacht) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${skyTop}"/>
          <stop offset="62%" stop-color="${skyBottom}"/>
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${seaColor}"/>
          <stop offset="100%" stop-color="#071525"/>
        </linearGradient>
        <radialGradient id="sun" cx="72%" cy="28%" r="22%">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="320" fill="url(#sky)"/>
      <circle cx="576" cy="145" r="110" fill="url(#sun)"/>
      <!-- Distant Dalmatian / Mediterranean Headlands -->
      <path d="M0,320 L0,255 L95,215 L195,248 L310,192 L430,242 L540,218 L670,255 L800,225 L800,320 Z" fill="#182b3e" opacity="0.55"/>
      <path d="M120,320 L215,245 L340,268 L480,220 L615,260 L750,240 L800,265 L800,320 Z" fill="#102031" opacity="0.82"/>
      <!-- Sea -->
      <rect y="315" width="800" height="205" fill="url(#sea)"/>
      <!-- Sun reflection lines -->
      <g stroke="${accentColor}" stroke-opacity="0.35" stroke-linecap="round">
        <line x1="535" y1="332" x2="615" y2="332" stroke-width="3"/>
        <line x1="548" y1="348" x2="602" y2="348" stroke-width="2.5"/>
        <line x1="525" y1="366" x2="622" y2="366" stroke-width="2"/>
        <line x1="555" y1="386" x2="595" y2="386" stroke-width="2"/>
      </g>
      ${
        isYacht
          ? `<!-- 43m Sailing Superyacht Silhouette -->
      <g transform="translate(230, 115)">
        <!-- Main Mast & Mizzen -->
        <line x1="150" y1="20" x2="150" y2="212" stroke="#e2d5b5" stroke-width="3"/>
        <line x1="238" y1="58" x2="238" y2="210" stroke="#e2d5b5" stroke-width="2.4"/>
        <!-- Sails -->
        <path d="M146,26 L62,196 L146,196 Z" fill="#f8f4e8" fill-opacity="0.92"/>
        <path d="M154,28 L225,192 L154,196 Z" fill="#ede4ce" fill-opacity="0.88"/>
        <path d="M242,64 L302,194 L242,196 Z" fill="#f8f4e8" fill-opacity="0.85"/>
        <!-- Hull -->
        <path d="M42,208 L325,208 L302,226 L68,226 Z" fill="#0d1b2a" stroke="#d4af37" stroke-width="1.5"/>
        <path d="M115,198 L255,198 L268,208 L102,208 Z" fill="#f4efe2"/>
        <line x1="55" y1="215" x2="310" y2="215" stroke="#d4af37" stroke-width="1.2"/>
      </g>`
          : `<!-- Historic Coastal Town Silhouette -->
      <g transform="translate(80, 248)" fill="#162638" stroke="#d4af37" stroke-width="0.8" stroke-opacity="0.45">
        <rect x="40" y="32" width="28" height="36"/>
        <polygon points="38,32 54,12 70,32" fill="#b45309"/>
        <rect x="72" y="42" width="44" height="26"/>
        <rect x="122" y="20" width="18" height="48"/>
        <polygon points="120,20 131,2 142,20" fill="#d97706"/>
        <rect x="145" y="38" width="52" height="30"/>
      </g>`
      }
      <!-- Subtle Vignette & Caption Bar -->
      <rect y="430" width="800" height="90" fill="#0b131e" fill-opacity="0.72"/>
      <text x="32" y="468" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Inter, sans-serif" font-size="24" font-weight="700" letter-spacing="-0.4">${title}</text>
      <text x="32" y="495" fill="#d1d5db" font-family="-apple-system, BlinkMacSystemFont, Inter, sans-serif" font-size="15" font-weight="500">${subtitle}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function makeCrewAvatarSvg(initials, roleColor, bgTop, bgBottom) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bgTop}"/>
          <stop offset="100%" stop-color="${bgBottom}"/>
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="120" fill="url(#g)"/>
      <circle cx="120" cy="92" r="38" fill="#ffffff" fill-opacity="0.18"/>
      <path d="M52,212 C52,162 188,162 188,212" fill="#ffffff" fill-opacity="0.18"/>
      <text x="120" y="134" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Inter, sans-serif" font-size="52" font-weight="600" letter-spacing="-1">${initials}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // 66 Mediterranean Preset Ports (identical coordinates to PassPlan) + Rich Curated Mini-Guides
  const PRESET_PORTS = [
    {
      id: 'porto-montenegro',
      name: 'Porto Montenegro',
      country: 'Montenegro',
      lat: 42.433,
      lon: 18.692,
      atmosphere: 'Glamorous superyacht village nestled deep inside the UNESCO-protected fjord of Boka Kotorska.',
      history: 'Once the Austro-Hungarian naval arsenal of Tivat, transformed into the Adriatic’s premier superyacht homeport surrounded by dramatic limestone peaks.',
      highlights: ['Regent Pool Club & waterfront promenade', 'Naval Heritage Collection submarine museum', 'Sunset aperitivo overlooking Lovćen mountain'],
      tenderName: 'Jetty 1 · Superyacht Quay South',
      tenderNote: 'Meet the Delusha tender beside the main customs pier next to Yacht Club pool.',
      tenderLat: 42.4332,
      tenderLon: 18.6915
    },
    {
      id: 'kotor',
      name: 'Kotor',
      country: 'Montenegro',
      lat: 42.424,
      lon: 18.769,
      atmosphere: 'Dramatic medieval walled town beneath sheer 1,000-meter karst cliffs at the innermost tip of the bay.',
      history: 'Fortified by Venetians for four centuries (`Cattaro`), Kotor’s labyrinth of marble squares and Romanesque churches is a UNESCO World Heritage treasure.',
      highlights: ['11th-century Cathedral of Saint Tryphon', 'San Giovanni fortress ramparts walk', 'Boat excursion to Our Lady of the Rocks islet off Perast'],
      tenderName: 'Kotor Town Quay (Riva Pier)',
      tenderNote: 'Directly opposite the Sea Gate main entrance to the Old Town.',
      tenderLat: 42.4245,
      tenderLon: 18.7688
    },
    {
      id: 'budva',
      name: 'Budva',
      country: 'Montenegro',
      lat: 42.278,
      lon: 18.837,
      atmosphere: 'Sun-drenched walled citadel and sandy riviera beaches with nearby iconic Sveti Stefan island.',
      history: 'Over 2,500 years old, settled by Illyrians, Greeks, and Venetians along the Adriatic trade route.',
      highlights: ['Budva Citadela sea-view library', 'Sveti Stefan pink-pebble isthmus anchorage', 'Old Town stone alleys & Mogren cliffs'],
      tenderName: 'Dukley Marina Tender Dock A',
      tenderNote: 'Inside the breakwater right beside the Old Town North Gate.',
      tenderLat: 42.2782,
      tenderLon: 18.8380
    },
    {
      id: 'dubrovnik',
      name: 'Dubrovnik',
      country: 'Croatia',
      lat: 42.660,
      lon: 18.080,
      atmosphere: 'The "Pearl of the Adriatic"—monumental limestone ramparts, baroque palaces, and pine-scented Elaphiti islands.',
      history: 'As the independent maritime Republic of Ragusa, Dubrovnik rivaled Venice in diplomacy, merchant shipping, and Renaissance civic architecture.',
      highlights: ['Walk the 2 km medieval City Walls at golden hour', 'Stradun limestone promenade & Rector’s Palace', 'Swim & kayak inside Lokrum Island caves'],
      tenderName: 'Old Town Porporela Pier (Ploče Gate)',
      tenderNote: 'Historic stone harbor steps inside the Old Port breakwater.',
      tenderLat: 42.6406,
      tenderLon: 18.1114
    },
    {
      id: 'korcula',
      name: 'Korčula',
      country: 'Croatia',
      lat: 42.962,
      lon: 17.135,
      atmosphere: 'Herringbone-patterned medieval peninsula town famed for crisp Grk white wine and warm Pelješac channel breezes.',
      history: 'Reputed birthplace of explorer Marco Polo; engineered in a fishbone street layout to channel cooling Maestral winds and block winter gales.',
      highlights: ['St. Mark’s Cathedral & Marco Polo Tower', 'Evening Moreška sword-dance performance', 'Cliffside dining along the Lešić Dimitri promenade'],
      tenderName: 'Korčula West Riva Stone Steps',
      tenderNote: 'Below the Venetian Revelin Land Gate tower.',
      tenderLat: 42.9614,
      tenderLon: 17.1355
    },
    {
      id: 'hvar',
      name: 'Hvar',
      country: 'Croatia',
      lat: 43.172,
      lon: 16.441,
      atmosphere: 'Lavender-scented island glamour paired with the crystal-clear coves of the Pakleni Archipelago.',
      history: 'Home to Europe’s oldest public theatre (1612) and the grandest Renaissance piazza in Dalmatia, crowned by the Spanish Fortress.',
      highlights: ['Sunset views from Fortica Španjola', 'Turquoise swim stops in Vinogradišće (Palmižana)', 'St. Stephen’s Piazza & Franciscan Monastery'],
      tenderName: 'Hvar Town Riva (Gariful / Yacht Pier)',
      tenderNote: 'Central palm promenade tender landing zone.',
      tenderLat: 43.1718,
      tenderLon: 16.4412
    },
    {
      id: 'split',
      name: 'Split',
      country: 'Croatia',
      lat: 43.503,
      lon: 16.437,
      atmosphere: 'Vibrant Dalmatian capital where cafés, boutiques, and wine bars thrive inside a living Roman Emperor’s palace.',
      history: 'Founded in 305 AD when Roman Emperor Diocletian built his fortified retirement palace directly on the Adriatic shore.',
      highlights: ['Diocletian’s Palace Peristyle & Substructures', 'Marjan Hill pine forest viewpoint', 'Riva waterfront promenade & Riva Brass Gate'],
      tenderName: 'Split West Coast (Zapadna Obala) Quay',
      tenderNote: 'Superyacht promenade opposite Hotel Ambasador.',
      tenderLat: 43.5056,
      tenderLon: 16.4332
    },
    { id: 'sibenik', name: 'Šibenik', country: 'Croatia', lat: 43.734, lon: 15.889, atmosphere: 'Gateway to the Kornati Archipelago and Krka waterfalls, crowned by four sea & hilltop fortresses.', history: 'The oldest native Croatian town on the Adriatic, famous for its all-stone UNESCO Cathedral of St. James.', highlights: ['Cathedral of St. James interlocking stone dome', 'Cruise up the canyon to Skradinski Buk waterfalls', 'Michelin-starred Pelegrini dining'] },
    { id: 'zadar', name: 'Zadar', country: 'Croatia', lat: 44.117, lon: 15.224, atmosphere: 'Roman forum ruins meets contemporary sea-organ installations and gateway to Dugi Otok.', history: 'Three millennia of continuous urban life on a compact marble peninsula.', highlights: ['Sea Organ & Greeting to the Sun at sunset', '9th-century Rotunda of St. Donatus', 'Sali & Telašćica Nature Park cliffs nearby'] },
    { id: 'venice', name: 'Venice', country: 'Italy', lat: 45.430, lon: 12.340, atmosphere: 'Timeless lagoon serenity of marble palazzos, quiet canals, and historic Arsenale docks.', history: 'La Serenissima ruled Mediterranean maritime trade for over a thousand years.', highlights: ['Piazza San Marco & Doge’s Palace', 'Private Riva water-taxi tour of the Grand Canal', 'Torcello & Burano lagoon islands'] },
    { id: 'bari', name: 'Bari', country: 'Italy', lat: 41.130, lon: 16.870, atmosphere: 'Authentic Puglian port where grand boulevards meet the whitewashed lanes of Bari Vecchia.', history: 'Major Norman and Byzantine port housing the Basilica of Saint Nicholas.', highlights: ['Basilica San Nicola', 'Castello Normanno-Svevo', 'Handmade orecchiette pasta lanes'] },
    { id: 'brindisi', name: 'Brindisi', country: 'Italy', lat: 40.645, lon: 17.950, atmosphere: 'Natural double-arm harbor marking the historic terminus of Rome’s Via Appia.', history: 'Ancient Roman embarkation port for Greece and the Eastern Mediterranean.', highlights: ['Roman Columns of the Appian Way', 'Alfonsino Castle on the harbor entrance', 'Salento vineyards & masserie ashore'] },
    { id: 'corfu', name: 'Corfu', country: 'Greece', lat: 39.650, lon: 19.850, atmosphere: 'Lush emerald island blending Venetian fortresses, French arcades, and British cricket greens.', history: 'Never conquered by the Ottomans, Corfu’s Old Town is a masterpiece of Venetian aristocratic architecture.', highlights: ['Liston Arcade & Spianada Square', 'Old Venetian Fortress view over Mandraki', 'Bays of Paleokastritsa & Kassiopi'] },
    { id: 'paxos', name: 'Paxos', country: 'Greece', lat: 39.196, lon: 20.186, atmosphere: 'Intimate olive-draped Ionian jewel with electric-blue waters and sea caves.', history: 'According to myth, Poseidon struck Corfu with his trident to create a tranquil retreat for Amphitrite.', highlights: ['Gaios natural fjord-like harbor channel', 'Lakka turquoise bay swim', 'Voutoumi Beach on neighboring Antipaxos'] },
    { id: 'preveza', name: 'Preveza', country: 'Greece', lat: 38.958, lon: 20.752, atmosphere: 'Lively Neo-Classical waterfront at the mouth of the Ambracian Gulf.', history: 'Site of the ancient naval Battle of Actium (31 BC) and nearby Roman city of Nicopolis.', highlights: ['Seatan Pazar cobblestone tavern alleys', 'Ancient Nicopolis mosaics', 'Dolphin-spotting in the Ambracian Gulf'] },
    { id: 'lefkada', name: 'Lefkada', country: 'Greece', lat: 38.833, lon: 20.712, atmosphere: 'Gateway to the Inland Ionian Archipelago—Meganisi, Skorpios, and Kalamos.', history: 'Connected to mainland Epirus by a floating swing bridge and historic Santa Maura fortress.', highlights: ['Cliffside beaches of Porto Katsiki', 'Private bays around Meganisi & Skorpios', 'Lefkada Old Town wooden architecture'] },
    { id: 'fiskardo', name: 'Fiskardo', country: 'Greece', lat: 38.459, lon: 20.577, atmosphere: 'Pastel Venetian harbor village on northern Kefalonia framed by cypress trees.', history: 'Named after Norman leader Robert Guiscard; the only Kefalonian village spared by the 1953 earthquake.', highlights: ['Waterfront pastel dining along the quay', 'Venetian Lighthouse walk', 'Melissani underground lake nearby'] },
    { id: 'argostoli', name: 'Argostoli', country: 'Greece', lat: 38.180, lon: 20.490, atmosphere: 'Spacious sheltered bay where loggerhead sea turtles swim beside the stone De Bosset Bridge.', history: 'Capital of Kefalonia since 1757, famous for its philharmonic tradition and Robola vineyards.', highlights: ['Caretta caretta turtles along the quay', 'De Bosset stone bridge walk', 'St. George’s Castle hilltop views'] },
    { id: 'zakynthos', name: 'Zakynthos', country: 'Greece', lat: 37.780, lon: 20.900, atmosphere: 'Towering white chalk cliffs, Blue Caves, and golden turtle-nesting bays.', history: 'Praised by Homer and beloved by Venetians as "Fior di Levante" (Flower of the East).', highlights: ['Blue Caves at Cape Skinari', 'Marathonisi (Turtle Island) swim', 'Bochali hilltop sunset view'] },
    { id: 'pylos', name: 'Pylos', country: 'Greece', lat: 36.913, lon: 21.696, atmosphere: 'Vast natural lagoon of Navarino Bay sheltered by Sphacteria Island.', history: 'Scene of the Mycenaean Palace of Nestor and the decisive 1827 naval Battle of Navarino.', highlights: ['Neokastro Ottoman-Venetian fortress', 'Voidokilia omega-shaped beach', 'Costa Navarino golf & spa ashore'] },
    { id: 'kalamata', name: 'Kalamata', country: 'Greece', lat: 37.020, lon: 22.110, atmosphere: 'Messinian Gulf hub beneath the dramatic Taygetos mountain range.', history: 'Famed for world-renowned olives, Frankish castle ruins, and nearby rugged Mani towers.', highlights: ['13th-century Kalamata Castle', 'Ancient Messene archaeological site', 'Coastal cruise down the Mani Peninsula'] },
    { id: 'monemvasia', name: 'Monemvasia', country: 'Greece', lat: 36.687, lon: 23.057, atmosphere: 'The "Gibraltar of the East"—a car-free medieval fortress city carved into a giant sea rock.', history: 'Byzantine and Venetian stronghold linked to the Laconian mainland by a single narrow causeway.', highlights: ['Upper Town cliffside Church of Hagia Sophia', 'Car-free vaulted stone alleys', 'Malvasia sweet wine tasting'] },
    { id: 'hydra', name: 'Hydra', country: 'Greece', lat: 37.350, lon: 23.467, atmosphere: 'Aristocratic amphitheater harbor where no cars or scooters are permitted.', history: '18th-century maritime powerhouse of stone captains’ mansions and bohemian artists.', highlights: ['Sunset cocktails at Hydronetta cliff rocks', 'Lazaros Koundouriotis Historical Mansion', 'Coastal footpath to Kamini & Vlychos'] },
    { id: 'athens-alimos', name: 'Athens (Alimos)', country: 'Greece', lat: 37.910, lon: 23.710, atmosphere: 'Cosmopolitan Athenian Riviera beneath the marble gaze of the Acropolis.', history: 'Cradle of classical civilization and gateway to the Saronic Gulf and Cyclades.', highlights: ['The Acropolis & Acropolis Museum', 'Temple of Poseidon at Cape Sounion', 'Vouliagmeni Lake thermal waters'] },
    { id: 'mykonos', name: 'Mykonos', country: 'Greece', lat: 37.450, lon: 25.330, atmosphere: 'Iconic Cycladic whitewashed cube houses, windmills, and neighbouring sacred Delos.', history: 'Traditional Aegean fishing port turned world-famous island playground next to Apollo’s birthplace.', highlights: ['Little Venice & 16th-century Windmills', 'Morning tender excursion to UNESCO Delos Island', 'Psarou & Rhenia turquoise anchorages'] },
    { id: 'paros', name: 'Paros', country: 'Greece', lat: 37.085, lon: 25.150, atmosphere: 'Charming Naoussa fishing port and marble-paved Cycladic villages in the heart of the Aegean.', history: 'Source of the translucent Parian marble used to carve the Venus de Milo.', highlights: ['Naoussa Venetian harbor & dining', 'Lefkes mountain village marble trail', 'Blue Lagoon between Paros & Antiparos'] },
    { id: 'santorini', name: 'Santorini', country: 'Greece', lat: 36.420, lon: 25.430, atmosphere: 'Breathtaking volcanic caldera cliffs topped with sugar-cube villages of Oia and Fira.', history: 'Shaped by one of history’s largest volcanic eruptions around 1600 BC, preserving Minoan Akrotiri.', highlights: ['Oia sunset over the flooded caldera', 'Prehistoric town of Akrotiri', 'Assyrtiko volcanic vineyard tasting'] },
    { id: 'chania', name: 'Chania', country: 'Greece', lat: 35.520, lon: 24.020, atmosphere: 'Cretan jewel featuring a 14th-century Venetian harbor, Egyptian lighthouse, and White Mountains.', history: 'Built over ancient Minoan Kydonia, blending Venetian palaces and Ottoman domes.', highlights: ['Old Venetian Harbor & Lighthouse', 'Balos Lagoon & Gramvousa anchorage', 'Cretan gastronomy in Tabakaria'] },
    { id: 'heraklion', name: 'Heraklion', country: 'Greece', lat: 35.345, lon: 25.140, atmosphere: 'Historic Cretan capital guarded by the Venetian Koules fortress.', history: 'Heart of Europe’s earliest civilization—the Minoans—just minutes from the Palace of Knossos.', highlights: ['Palace of Knossos & Archaeological Museum', 'Koules Venetian sea fortress', 'Archanes wine country'] },
    { id: 'rhodes', name: 'Rhodes', country: 'Greece', lat: 36.450, lon: 28.230, atmosphere: 'Monumental medieval walled city of the Knights of St. John and Lindos acropolis.', history: 'Once stood the Colossus of Rhodes; today boasts the best-preserved medieval fortified town in Europe.', highlights: ['Palace of the Grand Master of the Knights', 'Street of the Knights', 'Lindos white village & cliffside Acropolis'] },
    { id: 'bodrum', name: 'Bodrum', country: 'Türkiye', lat: 37.030, lon: 27.430, atmosphere: 'Pine-clad Turkish Riviera bays and the Crusader Castle of St. Peter.', history: 'Ancient Halicarnassus, birthplace of Herodotus and site of the Mausoleum Wonder of the Ancient World.', highlights: ['Bodrum Castle & Museum of Underwater Archaeology', 'Yalıkavak & Türkbükü bays', 'Traditional gulet craftsmanship'] },
    { id: 'gocek', name: 'Göcek', country: 'Türkiye', lat: 36.750, lon: 28.940, atmosphere: 'Tranquil pine-ringed gulf dotted with 12 sheltered islands and Lycian rock tombs.', history: 'Ancient Kalimche in Lycia; today one of the Mediterranean’s calmest flat-water cruising grounds.', highlights: ['Cleopatra’s Bath Bay sunken ruins', 'Bedri Rahmi & Sarsala coves', 'Tersane Island ancient shipyard'] },
    { id: 'kas', name: 'Kaş', country: 'Türkiye', lat: 36.198, lon: 29.640, atmosphere: 'Bougainvillea-draped Lycian harbor facing the Greek island of Kastellorizo.', history: 'Ancient Antiphellos, famous for its sea-facing Hellenistic theater and Kekova sunken city.', highlights: ['Kekova Sunken Lycian City & Simena Castle', 'Antiphellos sunset amphitheater', 'Crystal diving & snorkeling reefs'] },
    { id: 'limassol', name: 'Limassol', country: 'Cyprus', lat: 34.670, lon: 33.040, atmosphere: 'Sunlit eastern Mediterranean crossroads with modern marina luxury and ancient Kourion cliffs.', history: 'Where Richard the Lionheart wed Berengaria of Navarre in Limassol Castle in 1191.', highlights: ['Ancient Kourion Greco-Roman cliff theater', 'Limassol Medieval Castle & Old Port', 'Troodos foothill Commandaria wineries'] },
    { id: 'valletta', name: 'Valletta', country: 'Malta', lat: 35.900, lon: 14.510, atmosphere: 'Honey-colored baroque bastions towering above the magnificent Grand Harbour.', history: 'Built by the Knights of Malta after the Great Siege of 1565; the entire city is a UNESCO monument.', highlights: ['St. John’s Co-Cathedral & Caravaggio masterpiece', 'Upper Barrakka Gardens cannon salute', 'Comino Blue Lagoon swim stop'] },
    { id: 'syracuse', name: 'Syracuse', country: 'Italy', lat: 37.060, lon: 15.290, atmosphere: 'Baroque island of Ortigia linked by bridges to ancient Greek Sicily.', history: 'Home of Archimedes and once the most powerful city in the ancient Greek world.', highlights: ['Piazza del Duomo on Ortigia Island', 'Maniace Castle at the harbor entrance', 'Neapolis Greek Theater & Ear of Dionysius'] },
    { id: 'taormina', name: 'Taormina', country: 'Italy', lat: 37.820, lon: 15.270, atmosphere: 'Cliffside Sicilian glamour overlooking Isola Bella and smoking Mount Etna.', history: 'Beloved Grand Tour destination where an ancient Greco-Roman theater frames Mount Etna and the Ionian Sea.', highlights: ['Ancient Theatre of Taormina', 'Isola Bella marine nature reserve swim', 'Corso Umberto promenade & Mount Etna wineries'] },
    { id: 'messina', name: 'Messina', country: 'Italy', lat: 38.190, lon: 15.560, atmosphere: 'Legendary Strait of Scylla and Charybdis separating Sicily from Calabria.', history: 'Strategic maritime gateway between the Ionian and Tyrrhenian Seas for three millennia.', highlights: ['Messina Cathedral astronomical clock tower', 'Fountain of Orion', 'Swordfish fleets of the Strait'] },
    { id: 'lipari', name: 'Lipari', country: 'Italy', lat: 38.465, lon: 14.960, atmosphere: 'Heart of the volcanic Aeolian Islands with white pumice bays and nearby Stromboli.', history: 'Neolithic obsidian trade center crowned by a 16th-century Spanish citadel.', highlights: ['Lipari Castle & Archaeological Museum', 'Pumice Quarry turquoise bay swim', 'Evening cruise past Stromboli’s Sciara del Fuoco'] },
    { id: 'palermo', name: 'Palermo', country: 'Italy', lat: 38.120, lon: 13.370, atmosphere: 'Grand Arab-Norman domes, golden mosaics, and sun-soaked Mondello bay.', history: 'Crossroads of Phoenician, Roman, Arab, Norman, and Spanish kingdoms in the Conca d’Oro.', highlights: ['Palatine Chapel Byzantine gold mosaics', 'Palermo Cathedral & Teatro Massimo', 'Mondello & Capo Gallo turquoise anchorage'] },
    { id: 'capri', name: 'Capri', country: 'Italy', lat: 40.556, lon: 14.240, atmosphere: 'Iconic Faraglioni sea stacks, Piazzetta elegance, and luminous sea grottos.', history: 'Imperial retreat of Roman Emperor Tiberius (Villa Jovis) and timeless symbol of La Dolce Vita.', highlights: ['Anchor beneath the Faraglioni rocks', 'Piazzetta & Gardens of Augustus', 'Blue Grotto & Anacapri chairlift to Monte Solaro'] },
    { id: 'amalfi', name: 'Amalfi', country: 'Italy', lat: 40.633, lon: 14.600, atmosphere: 'Vertical lemon-terraced cliffs, pastel Positano, and Ravello cliffside gardens.', history: 'The medieval Duchy of Amalfi authored the Tabula Amalphitana maritime code and traded across the Levant.', highlights: ['Cathedral of Sant’Andrea in Amalfi', 'Villa Rufolo & Villa Cimbrone in Ravello', 'Positano & Li Galli islands anchorage'] },
    { id: 'naples', name: 'Naples', country: 'Italy', lat: 40.835, lon: 14.250, atmosphere: 'Majestic Gulf of Naples framed by Mount Vesuvius, Castel dell’Ovo, and Procida/Ischia.', history: 'Founded as Greek Neapolis; gateway to Pompeii, Herculaneum, and royal Bourbon palaces.', highlights: ['Santa Lucia harbor & Castel dell’Ovo', 'Private excursion to Pompeii or Herculaneum', 'Aragonese Castle on neighboring Ischia'] },
    { id: 'ponza', name: 'Ponza', country: 'Italy', lat: 40.895, lon: 12.965, atmosphere: 'Crescent-shaped pastel harbor and dramatic white tuff cliffs of Chiaia di Luna.', history: 'Unspoiled Pontine archipelago island with Roman sea-water grottos of Pontius Pilate.', highlights: ['Grotte di Pilato Roman fish basins', 'Chiaia di Luna & Lucia Rosa arches', 'Palmarola uninhabited island day anchorage'] },
    { id: 'porto-cervo', name: 'Porto Cervo', country: 'Italy', lat: 41.135, lon: 9.540, atmosphere: 'Emerald granite coves of Costa Smeralda and the pink-sand islands of La Maddalena.', history: 'Created in the 1960s by Prince Karim Aga Khan to celebrate Sardinia’s wind-sculpted granite coastline.', highlights: ['Yacht Club Costa Smeralda & Piazzetta', 'La Maddalena & Budelli National Park', 'Cala di Volpe & Liscia Ruja anchorages'] },
    { id: 'cagliari', name: 'Cagliari', country: 'Italy', lat: 39.210, lon: 9.110, atmosphere: 'Hilltop Castello quarter overlooking the Flamingo lagoons and southern Sardinian beaches.', history: 'Ancient Phoenician Karalis and royal capital of Sardinia.', highlights: ['Bastione di Saint Remy panoramic terrace', 'Poetto & Villasimius turquoise capes', 'Roman Amphitheatre & Archaeological Museum'] },
    { id: 'bonifacio', name: 'Bonifacio', country: 'France', lat: 41.387, lon: 9.160, atmosphere: 'Awe-inspiring medieval citadel balanced on overhanging white chalk cliffs above a natural fjord.', history: 'Founded in 828 AD guarding the wind-swept Strait of Bonifacio between Corsica and Sardinia.', highlights: ['Enter the hidden calanque harbor through the cliffs', 'King of Aragon’s 187 cliffside steps', 'Lavezzi Islands granite lagoon anchorage'] },
    { id: 'ajaccio', name: 'Ajaccio', country: 'France', lat: 41.920, lon: 8.740, atmosphere: 'Imperial Corsican bay with golden beaches and the red granite Îles Sanguinaires.', history: 'Genoese citadel and birthplace of Napoleon Bonaparte in 1769.', highlights: ['Maison Bonaparte & Fesch Museum', 'Sunset anchorage at Îles Sanguinaires', 'Capo di Feno wild coast'] },
    { id: 'calvi', name: 'Calvi', country: 'France', lat: 42.567, lon: 8.757, atmosphere: 'Crescent pine beach and honey-stone Genoese citadel backed by snow-dusted Monte Cinto.', history: 'Loyal Genoese stronghold bearing the motto "Civitas Calvi Semper Fidelis".', highlights: ['Calvi Citadel cobblestone ramparts', 'Scandola UNESCO red-porphyry reserve nearby', 'Revellata peninsula swim'] },
    { id: 'portofino', name: 'Portofino', country: 'Italy', lat: 44.300, lon: 9.210, atmosphere: 'Intimate Ligurian jewel box of trompe-l’œil pastel facades and pine-clad Castello Brown.', history: 'Roman Portus Delphini (Port of the Dolphin) tucked into a verdant natural headland.', highlights: ['Piazzetta harbor & Castello Brown walk', 'San Fruttuoso Abbey & Christ of the Abyss dive', 'Faro di Portofino cliffside aperitivo'] },
    { id: 'genoa', name: 'Genoa', country: 'Italy', lat: 44.410, lon: 8.920, atmosphere: 'Grand Renaissance palaces of the Strade Nuove and historic Porto Antico.', history: 'La Superba—one of the great Maritime Republics and birthplace of Christopher Columbus.', highlights: ['UNESCO Palazzi dei Rolli on Via Garibaldi', 'Cathedral of San Lorenzo', 'Boccadasse colourful fishing village'] },
    { id: 'monaco', name: 'Monaco', country: 'Monaco', lat: 43.735, lon: 7.425, atmosphere: 'Port Hercule superyacht grandeur beneath the Prince’s Palace Rock and Monte-Carlo.', history: 'Ruled by the House of Grimaldi since 1297 on the sheer cliffs of the Côte d’Azur.', highlights: ['Monaco-Ville Rock & Oceanographic Museum', 'Place du Casino & Café de Paris', 'Yacht Club de Monaco'] },
    { id: 'antibes', name: 'Antibes', country: 'France', lat: 43.585, lon: 7.130, atmosphere: '16th-century Vauban ramparts, Picasso Museum, and pine-shaded Cap d’Antibes.', history: 'Ancient Greek Antipolis; home to Port Vauban’s International Quay and Villa Eilenroc.', highlights: ['Musée Picasso inside Château Grimaldi', 'Sentier du Littoral walk around Cap d’Antibes', 'Marché Provençal in Old Antibes'] },
    { id: 'cannes', name: 'Cannes', country: 'France', lat: 43.550, lon: 7.015, atmosphere: 'La Croisette palm boulevard paired with the peaceful monastery islands of Lérins.', history: 'Transformed from a Ligurian fishing village on Le Suquet hill into the capital of cinema and yachting.', highlights: ['Anchor between Île Sainte-Marguerite & Île Saint-Honorat', 'Le Suquet historic quarter views', 'Boulevard de la Croisette'] },
    { id: 'saint-tropez', name: 'Saint-Tropez', country: 'France', lat: 43.270, lon: 6.640, atmosphere: 'Terracotta bell tower, Place des Lices pétanque, and Pampelonne sandy bay.', history: 'Provençal fishing port immortalized by Signac, Matisse, and classic Les Voiles de Saint-Tropez regattas.', highlights: ['Vieux Port & Musée de l’Annonciade', 'Citadelle de Saint-Tropez maritime museum', 'Pampelonne & Cap Taillat anchorages'] },
    { id: 'marseille', name: 'Marseille', country: 'France', lat: 43.295, lon: 5.360, atmosphere: 'Historic Vieux-Port and the dramatic white limestone fjords of Cassis & Les Calanques.', history: 'France’s oldest city, founded by Greek mariners from Phocaea in 600 BC as Massalia.', highlights: ['Calanques National Park (En-Vau & Sormiou)', 'MuCEM & Fort Saint-Jean', 'Notre-Dame de la Garde basilica views'] },
    { id: 'barcelona', name: 'Barcelona', country: 'Spain', lat: 41.375, lon: 2.180, atmosphere: 'Port Vell superyacht marina steps from the Gothic Quarter and Gaudí’s architectural wonders.', history: 'Roman Barcino and medieval Catalan maritime capital.', highlights: ['Sagrada Família & Casa Batlló', 'Barri Gòtic & El Born tapas lanes', 'OneOcean Port Vell promenade'] },
    { id: 'mahon', name: 'Mahón', country: 'Spain', lat: 39.885, lon: 4.270, atmosphere: 'One of the world’s deepest natural harbors on unspoiled UNESCO Menorca.', history: 'Georgian mansions and British naval heritage blend with prehistoric Talayotic stone monuments.', highlights: ['3-mile natural fjord harbor cruise', 'Illa del Rei Hauser & Wirth gallery island', 'Cala Macarella & Cala Pregonda turquoise coves'] },
    { id: 'palma', name: 'Palma', country: 'Spain', lat: 39.565, lon: 2.635, atmosphere: 'Golden Gothic Cathedral of La Seu rising directly above the superyacht palms of Mallorca.', history: 'Royal capital of the Kingdom of Majorca, framed by the UNESCO Serra de Tramuntana mountains.', highlights: ['Catedral-Basílica de Santa María de Mallorca', 'Bellver circular Gothic castle', 'Cruising north to Deià & Puerto de Sóller'] },
    { id: 'ibiza', name: 'Ibiza', country: 'Spain', lat: 38.910, lon: 1.440, atmosphere: 'Renaissance walled Dalt Vila and the crystal Posidonia meadows of neighbouring Formentera.', history: 'Founded by Carthaginians in 654 BC; its acropolis fortifications and sea grass prairies are UNESCO World Heritage.', highlights: ['Dalt Vila UNESCO fortress walk at dusk', 'Ses Illetes white-sand anchorage on Formentera', 'Es Vedrà sunset sail'] },
    { id: 'javea', name: 'Jávea', country: 'Spain', lat: 38.795, lon: 0.190, atmosphere: 'Dramatic Cap de la Nau sea cliffs and pine-sheltered Cala Sardinera.', history: 'Historic Costa Blanca headland where the Montgó massif meets the Balearic Sea.', highlights: ['Cala Granadella & Portitxol island anchorage', 'Cabo de la Nao lighthouse cliffs', 'Historic sandstone Old Town'] },
    { id: 'valencia', name: 'Valencia', country: 'Spain', lat: 39.450, lon: -0.320, atmosphere: 'America’s Cup superyacht marina meets Calatrava’s futuristic City of Arts and Sciences.', history: 'Founded by Romans in 138 BC; home of the UNESCO Silk Exchange and authentic Valencian paella.', highlights: ['City of Arts & Sciences', 'La Lonja de la Seda Gothic hall', 'Turia Gardens & historic Carmen district'] },
    { id: 'cartagena', name: 'Cartagena', country: 'Spain', lat: 37.590, lon: -0.980, atmosphere: 'Deep amphitheater harbor surrounded by five hills, Roman ruins, and modernist palaces.', history: 'Founded by Hasdrubal as Qart Hadasht (Carthago Nova), Spain’s premier ancient naval port.', highlights: ['Roman Theatre Museum of Cartagena', 'Calle Mayor Art Nouveau architecture', 'Cabo de Palos marine reserve diving'] },
    { id: 'malaga', name: 'Málaga', country: 'Spain', lat: 36.715, lon: -4.415, atmosphere: 'Muelle Uno palm promenade beneath the Moorish Alcazaba and Gibralfaro castle.', history: 'Phoenician Malaka—over 2,800 years old and birthplace of Pablo Picasso.', highlights: ['Alcazaba & Roman Theatre', 'Museo Picasso Málaga', 'Muelle Uno superyacht quay'] },
    { id: 'gibraltar', name: 'Gibraltar', country: 'Gibraltar', lat: 36.140, lon: -5.355, atmosphere: 'The mythic Pillar of Hercules towering over the gateway between the Mediterranean and Atlantic.', history: 'Monolithic limestone promontory steeped in Moorish, Spanish, and British naval history.', highlights: ['Top of the Rock & St. Michael’s Cave', 'Dolphin pods in the Bay of Gibraltar', 'Europa Point views across to North Africa'] },
    { id: 'tunis', name: 'Tunis', country: 'Tunisia', lat: 36.810, lon: 10.300, atmosphere: 'Blue-and-white cliffside village of Sidi Bou Said and the ancient ruins of Carthage.', history: 'Heart of ancient Carthage and the Mediterranean’s southern narrows.', highlights: ['Sidi Bou Said blue-door cliff village', 'Carthage Antonine Baths & Byrsa Hill', 'Bardo National Museum'] }
  ];

  // Ensure every port has default tender coordinates if not explicitly customized
  for (const p of PRESET_PORTS) {
    if (!p.tenderName) p.tenderName = `${p.name} Town Pier / Yacht Tender Landing`;
    if (!p.tenderNote) p.tenderNote = `Meet the SY Delusha tender at the main harbour landing in ${p.name}.`;
    if (typeof p.tenderLat !== 'number') p.tenderLat = p.lat;
    if (typeof p.tenderLon !== 'number') p.tenderLon = p.lon;
  }

  // Yacht Specifications & Story for Tab 4
  const YACHT_INFO = {
    name: 'SY DELUSHA',
    tagline: '43m Custom Pedigree Sailing Superyacht · Mediterranean Flagship',
    summary:
      'Designed for effortless blue-water passages and tranquil Mediterranean anchorages, SY Delusha combines timeless naval architecture with expansive teak decks, a shaded al-fresco cockpit, and a panoramic deckhouse saloon.',
    specs: [
      { label: 'Length Overall (LOA)', value: '43.0 m (141 ft)' },
      { label: 'Beam', value: '8.90 m (29.2 ft)' },
      { label: 'Draft (Keel Up / Down)', value: '4.10 m / 6.20 m' },
      { label: 'Rig & Mast Height', value: 'Ketch / Sloop · 54.5 m Air Draft' },
      { label: 'Upwind Sail Area', value: '980 m² (10,550 sq ft)' },
      { label: 'Cruising / Max Speed', value: '10.5 kn / 14.2 kn under sail' },
      { label: 'Guest Accommodation', value: '8–10 Guests in 4 En-Suite Staterooms' },
      { label: 'Crew', value: '6 Dedicated Professional Crew' }
    ],
    gallery: [
      {
        id: 'yacht-hero-1',
        title: 'SY Delusha Under Full Sail',
        caption: 'Close-hauled past dramatic Mediterranean limestone cliffs under full main and genoa.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0009.jpg'
      },
      {
        id: 'yacht-hero-2',
        title: 'Golden Hour Offshore Reach',
        caption: 'Effortless blue-water cruising at sunset across open Mediterranean swells.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0016.jpg'
      },
      {
        id: 'yacht-hero-3',
        title: 'Passing the Headland Lighthouse',
        caption: 'Gliding silently under canvas beneath towering coastal cliffs at dusk.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0015.jpg'
      },
      {
        id: 'yacht-hero-4',
        title: 'Overhead Teak Deck & Rig Profile',
        caption: 'Bird’s-eye perspective of SY Delusha’s expansive Burmese teak decks and triple-spreader mast.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0011.jpg'
      },
      {
        id: 'yacht-hero-5',
        title: 'Aft Sun Deck & Transom Steps',
        caption: 'Dual parasols, twin sunpads, and custom curved teak steps leading to the swim platform.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0010.jpg'
      },
      {
        id: 'yacht-hero-6',
        title: 'Al-Fresco Cockpit Dining & Helm',
        caption: 'Shaded central cockpit with varnished teak dining table and twin navigation pedestals.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0014.jpg'
      },
      {
        id: 'yacht-hero-7',
        title: 'Sunken Foredeck Lounge',
        caption: 'Private shaded daybeds recessed into the flush foredeck for serene anchorage lounging.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0017.jpg'
      },
      {
        id: 'yacht-hero-8',
        title: 'Bow Profile at Anchor',
        caption: 'Sleek silver-grey hull lines and expansive foredeck sun awning.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0018.jpg'
      },
      {
        id: 'yacht-hero-9',
        title: 'Panoramic Deckhouse Saloon & Dining',
        caption: 'Wraparound 270° superstructure windows flooding the formal dining and lounge area with natural light.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0013.jpg'
      },
      {
        id: 'yacht-hero-10',
        title: 'Saloon Lounge & Anchorage Views',
        caption: 'Bespoke neutral upholstery and uninterrupted cliffside sea views from the main deckhouse.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0008.jpg'
      },
      {
        id: 'yacht-hero-11',
        title: 'Teak Side Decks & DELUSHA Boom',
        caption: 'Flush deck hatches, captive hydraulic winches, and custom-painted leisure furl boom.',
        src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0012.jpg'
      }
    ],
    lifeAboard: [
      {
        icon: '🦶',
        title: 'Barefoot & Soft Deck Shoes on Teak',
        text: 'To preserve our hand-laid Burmese teak decks, we kindly ask guests to go barefoot aboard or wear clean, non-marking deck shoes. A shoe basket is kept at the passerelle and tender boarding steps.'
      },
      {
        icon: '🚿',
        title: 'Marine Heads & Fresh Water',
        text: 'All en-suite heads use vacuum marine plumbing—please place nothing in the bowl except what is natural and the provided thin marine tissue. Fresh water is produced onboard via reverse-osmosis watermakers.'
      },
      {
        icon: '🦺',
        title: 'Safety, Lifejackets & Tender Transfers',
        text: 'Auto-inflatable lifejackets and emergency muster instructions are located inside your cabin wardrobe. When sailing at high heel angles or boarding the tender at night, please follow the deck crew’s guidance.'
      },
      {
        icon: '☀️',
        title: 'Sunscreen & Sail Care',
        text: 'Spray-on bronzing oils and tinted sunblocks can permanently stain teak caulking and white Sunbrella cushions—lotion sunscreens are complimentary in the cockpit basket.'
      }
    ]
  };

  // Water Toys & Tender Locker for Tab 4
  const WATER_TOYS = [
    {
      id: 'toy-tender',
      icon: '🚤',
      name: '6.2m Custom Luxury Rib Tender',
      spec: '150 HP · 10 Guests · Teak Boarding Steps',
      description: 'Our primary shore limousine and watersports tow boat, equipped with Fusion audio, dry storage, and warm towel lockers.'
    },
    {
      id: 'toy-seabob',
      icon: '🐬',
      name: '2× Seabob F5S Underwater Scooters',
      spec: '6 Power Gears · Up to 20 km/h',
      description: 'Glide effortlessly across crystal-clear coves or dive down along reef walls with zero exertion.'
    },
    {
      id: 'toy-efoil',
      icon: '⚡',
      name: 'Lift3 eFoil Electric Hydrofoil',
      spec: 'Carbon Fiber Wing · Wireless Hand Controller',
      description: 'Fly silently above flat morning anchorages. Our First Officer and Deckhand offer 1-on-1 beginner coaching.'
    },
    {
      id: 'toy-sup',
      icon: '🏄',
      name: '4× Teak-Veneer Stand-Up Paddleboards',
      spec: 'All-Around Cruising & Yoga Stability',
      description: 'Ideal for quiet morning paddles into hidden sea caves and shallow lagoons right after sunrise.'
    },
    {
      id: 'toy-wake',
      icon: '🎿',
      name: 'Wakeboard, Monoski & Combo Water-Skis',
      spec: 'Adult & Junior Bindings + Towable Donuts',
      description: 'Ask the deck crew anytime at anchor for a sunset wake session or high-speed towable run behind the main tender.'
    },
    {
      id: 'toy-platform',
      icon: '🏝️',
      name: 'NautiBuoy Floating Teak Sea Lounge',
      spec: 'Modular Swim Raft & Seabob Dock',
      description: 'Deployed off the stern swim platform to create an extended sea-level beach club with loungers.'
    },
    {
      id: 'toy-dive',
      icon: '🤿',
      name: 'Full Snorkeling & Rendezvous Dive Locker',
      spec: 'Cressi Panoramic Masks, Fins & Shorty Wetsuits',
      description: 'Full range of adult and youth sizes ready on the swim transom, plus underwater GoPro housing.'
    },
    {
      id: 'toy-fishing',
      icon: '🎣',
      name: 'Mediterranean Offshore Trolling & Jigging Gear',
      spec: 'Shimano Tiagra Reels & Casting Rods',
      description: 'Trolled off the stern during passages for fresh mahi-mahi and tuna—prepared sashimi-style by our Chef.'
    }
  ];

  // Default Crew Directory for Tab 3
  const DEFAULT_CREW = [
    {
      id: 'crew-1',
      name: 'Capt. Marko Vuković',
      role: 'Captain',
      nationality: '🇭🇷 Croatia',
      languages: 'English, Croatian, Italian',
      onboard: true,
      avatar: makeCrewAvatarSvg('MV', '#f59e0b', '#0f2537', '#1e3a5f'),
      bio: 'Born on the island of Korčula with over 22 years commanding large sailing yachts across the Mediterranean and Caribbean. Marko knows every hidden calanque, wind shift, and family-run konoba from Venice to Bodrum.'
    },
    {
      id: 'crew-2',
      name: 'Lucas Moreau',
      role: 'Chief Officer',
      nationality: '🇫🇷 France',
      languages: 'English, French, Spanish',
      onboard: true,
      avatar: makeCrewAvatarSvg('LM', '#38bdf8', '#162b40', '#0d9488'),
      bio: 'Hailing from Brittany’s offshore racing circuit, Lucas oversees sail trim, navigation, and watersports coaching. Whether hoisting the asymmetric spinnaker or teaching guests the eFoil, he brings infectious enthusiasm.'
    },
    {
      id: 'crew-3',
      name: 'Elena Rostova',
      role: 'Executive Chef',
      nationality: '🇬🇷 Greece / 🇮🇹 Italy',
      languages: 'English, Greek, Italian',
      onboard: true,
      avatar: makeCrewAvatarSvg('ER', '#fb923c', '#3b1d2e', '#7c2d12'),
      bio: 'Trained in Milan and Athens, Elena crafts light, vibrant Mediterranean cuisine around each morning’s local fish market, organic island produce, and warm sourdough baked fresh aboard at dawn.'
    },
    {
      id: 'crew-4',
      name: 'Sophie Vance',
      role: 'Chief Stewardess',
      nationality: '🇬🇧 United Kingdom',
      languages: 'English, French',
      onboard: true,
      avatar: makeCrewAvatarSvg('SV', '#e2b857', '#1e293b', '#334155'),
      bio: 'With a background in luxury boutique hospitality and WSET wine & cocktail curation, Sophie ensures your stateroom, table settings, and ashore reservations run with warm, seamless precision.'
    },
    {
      id: 'crew-5',
      name: 'Nikos Papadakis',
      role: 'Chief Engineer',
      nationality: '🇬🇷 Greece',
      languages: 'English, Greek',
      onboard: true,
      avatar: makeCrewAvatarSvg('NP', '#2dd4bf', '#0f292e', '#115e59'),
      bio: 'Former merchant marine and superyacht refit engineer who keeps Delusha’s captive winches, hybrid power management, watermakers, and Starlink running silently around the clock.'
    },
    {
      id: 'crew-6',
      name: 'Mateo Rossi',
      role: 'Deckhand & Watersports Lead',
      nationality: '🇮🇹 Italy',
      languages: 'English, Italian',
      onboard: true,
      avatar: makeCrewAvatarSvg('MR', '#60a5fa', '#172554', '#1e40af'),
      bio: 'Certified RYA Yachtmaster and PADI Divemaster from Sardinia. Mateo pilots the custom tender, sets up beach club swim stops, and captures great drone shots of guests under sail.'
    }
  ];

  // Pre-seeded Trips ("Voyage Passes")
  const INITIAL_VOYAGES = [
    {
      id: 'voyage-july-2026',
      code: 'DELUSHA-JULY-2026',
      title: 'Montenegro & Dalmatian Islands Odyssey',
      subtitle: 'Boka Kotorska to the Pakleni Archipelago & Split',
      dates: 'July 14 – July 21, 2026',
      cruisingSpeed: 8.5,
      allowCorinth: false,
      activeStopIndex: 2, // Currently at Korčula (index 2: Porto Montenegro=0, Dubrovnik=1, Korčula=2, Hvar=3, Split=4)
      briefing: {
        currentLocation: 'Korčula Old Town Anchorage, Croatia',
        weatherSummary: 'Sunny & Clear · Afternoon NW Maestral 14–18 kn',
        airTemp: '29°C',
        seaTemp: '25°C',
        schedule: [
          { time: '08:30', activity: 'Morning swim, Seabobs & paddleboards off Badija Monastery lagoon' },
          { time: '09:30', activity: 'Mediterranean breakfast served on the aft teak cockpit' },
          { time: '11:30', activity: 'Weigh anchor & set full sail through the Pelješac Channel toward Hvar (34 nm / ~4h)' },
          { time: '15:45', activity: 'Drop anchor in Vinogradišće Bay (Pakleni Islands) for afternoon swim & lunch' },
          { time: '19:45', activity: 'Tender transfer ashore to Hvar Town Riva for sunset aperitivo & dinner' }
        ]
      },
      stops: [
        {
          uid: 'st-pm',
          portId: 'porto-montenegro',
          name: 'Porto Montenegro',
          country: 'Montenegro',
          lat: 42.433,
          lon: 18.692,
          dayLabel: 'Day 1 · Jul 14',
          status: 'completed',
          tenderName: 'Jetty 1 · Superyacht Quay South',
          tenderNote: 'Beside Regent Pool Club & main customs pier.',
          tenderLat: 42.4332,
          tenderLon: 18.6915
        },
        {
          uid: 'st-dbv',
          portId: 'dubrovnik',
          name: 'Dubrovnik',
          country: 'Croatia',
          lat: 42.660,
          lon: 18.080,
          dayLabel: 'Day 2 · Jul 15',
          status: 'completed',
          tenderName: 'Old Town Porporela Pier (Ploče Gate)',
          tenderNote: 'Stone steps inside the historic Old Port.',
          tenderLat: 42.6406,
          tenderLon: 18.1114
        },
        {
          uid: 'st-kor',
          portId: 'korcula',
          name: 'Korčula',
          country: 'Croatia',
          lat: 42.962,
          lon: 17.135,
          dayLabel: 'Day 3–4 · Jul 16–17',
          status: 'current',
          tenderName: 'Korčula West Riva Stone Steps',
          tenderNote: 'Directly below the Venetian Revelin Tower.',
          tenderLat: 42.9614,
          tenderLon: 17.1355
        },
        {
          uid: 'st-hvar',
          portId: 'hvar',
          name: 'Hvar',
          country: 'Croatia',
          lat: 43.172,
          lon: 16.441,
          dayLabel: 'Day 5–6 · Jul 18–19',
          status: 'upcoming',
          tenderName: 'Hvar Town Riva (Yacht Pier)',
          tenderNote: 'Central palm promenade tender landing.',
          tenderLat: 43.1718,
          tenderLon: 16.4412
        },
        {
          uid: 'st-split',
          portId: 'split',
          name: 'Split',
          country: 'Croatia',
          lat: 43.503,
          lon: 16.437,
          dayLabel: 'Day 7 · Jul 20–21',
          status: 'upcoming',
          tenderName: 'Split Zapadna Obala Superyacht Quay',
          tenderNote: 'West Riva promenade opposite Hotel Ambasador.',
          tenderLat: 43.5056,
          tenderLon: 16.4332
        }
      ],
      logbookStamps: [
        {
          day: 'Day 1 · Jul 14',
          route: 'Porto Montenegro → Bay of Kotor Sunset Sail',
          nm: 14.2,
          peakSpeedKn: 10.4,
          wind: 'W 13 kn · Smooth fjord water',
          note: 'Welcome champagne aboard followed by an evening reach past Perast & Our Lady of the Rocks.'
        },
        {
          day: 'Day 2 · Jul 15',
          route: 'Porto Montenegro → Cavtat & Dubrovnik',
          nm: 33.8,
          peakSpeedKn: 12.8,
          wind: 'NW Maestral 16–19 kn · Beam reach',
          note: 'Cleared Mamula island at 10:15 AM and flew full main & genoa all the way to Lokrum anchorage.'
        },
        {
          day: 'Day 3 · Jul 16',
          route: 'Dubrovnik → Šipan → Korčula Old Town',
          nm: 46.5,
          peakSpeedKn: 13.6,
          wind: 'WNW 18–21 kn · Brisk afternoon breeze',
          note: 'Lunch swim in Lopud Bay, then thrilling 13.6-knot reach up the Mljet Channel into Korčula.'
        }
      ],
      media: [
        {
          id: 'demo-media-1',
          type: 'photo',
          title: 'SY Delusha Under Full Canvas Off the Cliffs',
          author: 'Capt. Marko',
          stopName: 'Porto Montenegro',
          dayLabel: 'Day 1 · Jul 14',
          timestamp: '2026-07-14T17:40:00Z',
          lat: 42.452,
          lon: 18.682,
          favorites: 9,
          favoritedByMe: true,
          sizeLabel: '1.3 MB · Optimized HD',
          driveSynced: true,
          src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0009.jpg'
        },
        {
          id: 'demo-media-2',
          type: 'photo',
          title: '13.6 Knots Golden Hour Reach in Mljet Channel',
          author: 'Mateo (Deck)',
          stopName: 'Dubrovnik',
          dayLabel: 'Day 2 · Jul 15',
          timestamp: '2026-07-15T15:10:00Z',
          lat: 42.745,
          lon: 17.785,
          favorites: 12,
          favoritedByMe: true,
          sizeLabel: '1.4 MB · Optimized HD',
          driveSynced: true,
          src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0016.jpg'
        },
        {
          id: 'demo-media-3',
          type: 'photo',
          title: 'Passing the Headland Lighthouse at Dusk',
          author: 'Guest · Sarah',
          stopName: 'Korčula',
          dayLabel: 'Day 3 · Jul 16',
          timestamp: '2026-07-16T19:52:00Z',
          lat: 42.962,
          lon: 17.135,
          favorites: 10,
          favoritedByMe: true,
          sizeLabel: '1.2 MB · Optimized HD',
          driveSynced: true,
          src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0015.jpg'
        },
        {
          id: 'demo-media-4',
          type: 'photo',
          title: 'Aft Sun Deck & Swim Transom at Anchor',
          author: 'Lucas (Chief Officer)',
          stopName: 'Korčula',
          dayLabel: 'Day 4 · Jul 17',
          timestamp: '2026-07-17T10:15:00Z',
          lat: 42.954,
          lon: 17.168,
          favorites: 8,
          favoritedByMe: true,
          sizeLabel: '1.3 MB · Optimized HD',
          driveSynced: true,
          src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0010.jpg'
        },
        {
          id: 'demo-media-5',
          type: 'photo',
          title: 'Al-Fresco Lunch Setup in the Cockpit',
          author: 'Sophie (Chief Stew)',
          stopName: 'Korčula',
          dayLabel: 'Day 4 · Jul 17',
          timestamp: '2026-07-17T13:05:00Z',
          lat: 42.958,
          lon: 17.149,
          favorites: 7,
          favoritedByMe: false,
          sizeLabel: '1.1 MB · Optimized HD',
          driveSynced: true,
          src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0014.jpg'
        },
        {
          id: 'demo-media-6',
          type: 'photo',
          title: 'Panoramic Deckhouse Saloon Overlooking the Cove',
          author: 'Guest · David',
          stopName: 'Dubrovnik',
          dayLabel: 'Day 2 · Jul 15',
          timestamp: '2026-07-15T18:20:00Z',
          lat: 42.648,
          lon: 18.095,
          favorites: 8,
          favoritedByMe: true,
          sizeLabel: '1.2 MB · Optimized HD',
          driveSynced: true,
          src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0013.jpg'
        }
      ]
    },
    {
      id: 'voyage-aug-2026',
      code: 'DELUSHA-AUG-2026',
      title: 'Ionian Emerald & Corinth Passage',
      subtitle: 'Corfu, Paxos, Fiskardo & Hydra via the Corinth Canal',
      dates: 'August 8 – August 15, 2026',
      cruisingSpeed: 8.5,
      allowCorinth: true,
      activeStopIndex: 1,
      briefing: {
        currentLocation: 'Gaios Natural Fjord, Paxos, Greece',
        weatherSummary: 'Warm & Calm · Afternoon NW Maestro 12 kn',
        airTemp: '31°C',
        seaTemp: '26°C',
        schedule: [
          { time: '09:00', activity: 'Morning tender cruise to the Blue Caves & Antipaxos Voutoumi Bay' },
          { time: '12:30', activity: 'Set sail south toward Lefkada & Fiskardo, Kefalonia (48 nm / ~5.5h)' },
          { time: '20:00', activity: 'Dinner ashore on the pastel Venetian waterfront of Fiskardo' }
        ]
      },
      stops: [
        { uid: 'st-cfu', portId: 'corfu', name: 'Corfu', country: 'Greece', lat: 39.650, lon: 19.850, dayLabel: 'Day 1 · Aug 8', status: 'completed', tenderName: 'Old Venetian Fortress Mandraki Pier', tenderNote: 'Below the Old Fortress Yacht Club.', tenderLat: 39.6245, tenderLon: 19.9285 },
        { uid: 'st-pax', portId: 'paxos', name: 'Paxos', country: 'Greece', lat: 39.196, lon: 20.186, dayLabel: 'Day 2 · Aug 9', status: 'current', tenderName: 'Gaios Central Square Quay', tenderNote: 'In the sheltered island channel opposite the square.', tenderLat: 39.1972, tenderLon: 20.1848 },
        { uid: 'st-fis', portId: 'fiskardo', name: 'Fiskardo', country: 'Greece', lat: 38.459, lon: 20.577, dayLabel: 'Day 3–4 · Aug 10–11', status: 'upcoming', tenderName: 'Fiskardo North Pastel Quay', tenderNote: 'Right alongside the waterfront tavernas.', tenderLat: 38.4588, tenderLon: 20.5765 },
        { uid: 'st-hyd', portId: 'hydra', name: 'Hydra', country: 'Greece', lat: 37.350, lon: 23.467, dayLabel: 'Day 5–7 · Aug 12–15', status: 'upcoming', tenderName: 'Hydra Clocktower Marble Pier', tenderNote: 'Center of the car-free horseshoe harbor.', tenderLat: 37.3498, tenderLon: 23.4662 }
      ],
      logbookStamps: [
        {
          day: 'Day 1 · Aug 8',
          route: 'Corfu Mandraki → Gaios, Paxos',
          nm: 31.4,
          peakSpeedKn: 11.9,
          wind: 'NW 14 kn · Broad reach',
          note: 'Glorious afternoon sail down the Corfu Channel with dolphins off the bow.'
        }
      ],
      media: [
        {
          id: 'demo-aug-1',
          type: 'photo',
          title: 'Anchored off Antipaxos Electric-Blue Water',
          author: 'Capt. Marko',
          stopName: 'Paxos',
          dayLabel: 'Day 2 · Aug 9',
          timestamp: '2026-07-09T13:20:00Z',
          lat: 39.152,
          lon: 20.232,
          favorites: 11,
          favoritedByMe: true,
          sizeLabel: '1.4 MB · Optimized HD',
          driveSynced: true,
          src: './Delusha%20Beauty%20Shots/IMG-20250617-WA0011.jpg'
        }
      ]
    }
  ];

  self.DELUSHA_DATA = {
    PRESET_PORTS,
    YACHT_INFO,
    WATER_TOYS,
    DEFAULT_CREW,
    INITIAL_VOYAGES,
    makeSceneSvg,
    makeCrewAvatarSvg
  };
})();
