// Destination guides written for Delusha guests. Hosts can override any guide in the Host console.
// Each guide: key, aliases (names that should match a stop), wiki (Wikipedia title for the header photo),
// lede, picks, eat, know, story.

export const GUIDES = [
  {
    key: 'palma',
    aliases: ['palma', 'palma de mallorca', 'club de mar', 'port of palma'],
    name: 'Palma',
    region: 'Mallorca, Spain',
    wiki: 'Palma de Mallorca',
    lede: 'A Gothic cathedral rising straight out of the sea wall, a medieval old town of honey-coloured stone, and one of the best food cities in Spain, all a ten-minute walk from the marina.',
    picks: [
      { tag: 'Walk · 15 min', level: 'Easy', title: 'La Seu at golden hour', text: 'Walk the sea wall below the cathedral as the sun drops. Inside, look for the swirling Gaudí canopy over the altar and Miquel Barceló’s ceramic chapel, wild, modern and unforgettable.' },
      { tag: 'Wander · 1–2 h', level: 'Easy', title: 'Lose yourself in the old town', text: 'Duck into the lanes behind the Almudaina palace. Courtyards (patis) of the old palaces sit behind heavy doors; many are open to peek into. End at Plaça Major and the shops along Carrer de Sant Miquel.' },
      { tag: 'Taxi · 10 min', level: 'Easy', title: 'Bellver Castle', text: 'A perfectly round 14th-century castle in the pines above the city. Go for the view over the whole bay and, if you’re lucky, Delusha at her berth.' },
      { tag: 'Walk · 20 min', level: 'Easy', title: 'Santa Catalina', text: 'The old fishermen’s quarter, now Palma’s liveliest neighbourhood. Graze the market stalls in the morning, come back for tapas and cocktails at night.' }
    ],
    eat: [
      { name: 'Can Joan de s’Aigo', note: 'Since 1700. Ensaïmadas and almond ice cream in a tiled old-town café. Go mid-morning.', badge: 'Classic' },
      { name: 'Mercat de l’Olivar', note: 'The central market. Oysters and cava at the fish counters, jamón by the slice.', badge: 'Market' },
      { name: 'Santa Catalina tapas bars', note: 'Hop between bars on Carrer de Sant Magí. Book anywhere popular on Fridays and Saturdays.', badge: 'Evening' }
    ],
    know: [
      { label: 'Language', text: 'Mallorquí (Catalan) and Spanish. English widely spoken.' },
      { label: 'Eating times', text: 'Lunch 13:30–15:30, dinner from 20:30. Kitchens close mid-afternoon.' },
      { label: 'Sundays', text: 'Most shops close. Cafés, museums and the cathedral stay open.' },
      { label: 'Tipping', text: 'Round up, or 5–10% for good service.' }
    ],
    story: 'Romans, Moors and Catalan kings all ruled from this bay. James I of Aragon took the city in 1229 and began La Seu on the site of the great mosque; it took almost four centuries to finish and has one of the largest rose windows in the world. Palma’s modern fortune came with tourism in the 1950s, but the old town has kept its quiet, aristocratic soul.'
  },
  {
    key: 'cabrera',
    aliases: ['cabrera', 'cabrera national park', 'cabrera harbour', 'cabrera island', 'illa de cabrera', 'parc nacional de cabrera'],
    name: 'Cabrera',
    region: 'Balearic Islands, Spain',
    wiki: 'Cabrera Archipelago Maritime-Terrestrial National Park',
    lede: 'A wild, almost empty island off Mallorca’s south coast. No hotels, no cars, one tiny harbour, and some of the clearest water in the Mediterranean.',
    picks: [
      { tag: 'Walk · 40 min', level: 'Easy', title: 'Climb to the castle', text: 'A short, rocky path from the harbour to the 14th-century fortress. The view back over the anchorage, and Delusha on her buoy, is the photo of the trip.' },
      { tag: 'By tender · 15 min', level: 'Calm days', title: 'Sa Cova Blava, the Blue Cave', text: 'Swim into a sea cave that glows electric blue in the afternoon light. The crew will judge the swell before you go.' },
      { tag: 'Snorkel', level: 'From the boat', title: 'The seagrass meadows', text: 'Groupers, octopus and shoals of bream graze over protected Posidonia right below the mooring. Masks and fins are in the swim-platform locker.' },
      { tag: 'Walk · 20 min', level: 'Easy', title: 'Es Celler museum', text: 'A small museum in an old wine cellar telling the island’s story, from Roman fishing to its darker years as a prison camp.' }
    ],
    eat: [
      { name: 'Harbour cantina', note: 'The island’s only bar. Cold drinks and simple snacks, cash only, closes early.', badge: 'Basic' },
      { name: 'Dinner aboard', note: 'There are no restaurants on the island. The chef is cooking tonight.', badge: 'Aboard', menu: true }
    ],
    know: [
      { label: 'Protected park', text: 'Take nothing, leave nothing. No fishing, no feeding wildlife.' },
      { label: 'Bring', text: 'Water, a hat and proper shoes. There is very little shade.' },
      { label: 'Money', text: 'Euro. Bring some cash for the cantina.' },
      { label: 'Phone signal', text: 'Weak ashore. Starlink works aboard.' }
    ],
    story: 'Cabrera, “goat island”, guarded Mallorca’s southern approach for centuries; the castle was built against Barbary pirates. Between 1809 and 1814 thousands of French soldiers captured in the Peninsular War were abandoned here, and many never left. In 1991 the archipelago became Spain’s first land-and-sea national park, home to a tiny lizard found nowhere else on earth.'
  },
  {
    key: 'cala-mondrago',
    aliases: ['cala mondrago', 'cala mondragó', 'mondrago', 'mondragó', 's’amarador', "s'amarador", 'platja de s’amarador'],
    name: 'Cala Mondragó',
    region: 'Mallorca, Spain',
    wiki: 'Mondragó Natural Park',
    lede: 'Two pine-fringed coves of pale sand and impossibly turquoise water, protected inside a natural park so nothing will ever be built here. The Mallorca of postcards, before the postcards.',
    picks: [
      { tag: 'Swim', level: 'From the boat', title: 'Morning swim before the crowds', text: 'Be in the water before ten, when the light is low and the cove is yours. The water goes from emerald to glass-clear over the sand.' },
      { tag: 'Walk · 30 min', level: 'Easy', title: 'The cliff path to s’Amarador', text: 'A shaded coastal path links the two beaches over low cliffs, with views straight down into the coves.' },
      { tag: 'Paddle', level: 'Easy', title: 'Paddleboard the coastline', text: 'Hug the rocks south towards the next coves. Look down for fish over the sand patches.' },
      { tag: 'Taxi · 15 min', level: 'Easy', title: 'Santanyí village', text: 'Golden sandstone houses, galleries and a lively market on Wednesday and Saturday mornings.' }
    ],
    eat: [
      { name: 'Beach bars', note: 'Simple chiringuitos open in season for cold drinks and bocadillos. Hours shorten in autumn.', badge: 'Seasonal' },
      { name: 'Cala Figuera', note: 'A ten-minute tender ride: a working fishing harbour with fish restaurants on the water.', badge: 'By tender' }
    ],
    know: [
      { label: 'Natural park', text: 'Stay on the paths, no fires, take your rubbish back aboard.' },
      { label: 'Anchoring', text: 'Only on sand: Balearic law protects the seagrass.' },
      { label: 'Bring', text: 'Water shoes for the rocks, reef-safe sunscreen.' },
      { label: 'Phone signal', text: 'Good in the cove.' }
    ],
    story: 'Mondragó was saved by locals in the 1990s, when they fought off plans for hotels around the cove. It became a natural park in 1992. The farmland behind the beaches is still worked, and the dry-stone walls you see were built by hand over centuries.'
  },
  {
    key: 'port-de-soller',
    aliases: ['port de soller', 'port de sóller', 'soller', 'sóller', 'puerto de soller'],
    name: 'Port de Sóller',
    region: 'Mallorca, Spain',
    wiki: 'Port de Sóller',
    lede: 'A perfect horseshoe bay tucked into the Tramuntana mountains, with a wooden tram rattling along the seafront and orange groves climbing the valley behind.',
    picks: [
      { tag: 'Tram · 20 min', level: 'Easy', title: 'The 1913 tram to Sóller', text: 'Ride the open wooden tram up through the orange groves to Sóller town. Sit on the right going up for the best view.' },
      { tag: 'Wander · 1 h', level: 'Easy', title: 'Plaça de sa Constitució', text: 'Sóller’s main square, shaded by plane trees, with a church façade by a pupil of Gaudí. Have a fresh orange juice here; the oranges are from the valley.' },
      { tag: 'Taxi · 15 min', level: 'Easy', title: 'Fornalutx', text: 'Often called the prettiest village in Spain: steep stone lanes, green shutters and mountain views.' },
      { tag: 'Walk · 1 h', level: 'Moderate', title: 'Lighthouse at Cap Gros', text: 'A steady climb from the port to the lighthouse for sunset over the bay.' }
    ],
    eat: [
      { name: 'Sóller ice cream', note: 'Orange ice cream made from the valley’s fruit, sold in the town square.', badge: 'Sweet' },
      { name: 'Seafront fish restaurants', note: 'Grilled fish and paella along the port promenade. Book a terrace for sunset.', badge: 'Evening' }
    ],
    know: [
      { label: 'Getting around', text: 'Tram to town; the vintage train continues to Palma through the mountains.' },
      { label: 'Wind', text: 'The bay is well protected, except in strong north-westerlies.' },
      { label: 'Sundays', text: 'Shops in town close. The port stays lively.' },
      { label: 'UNESCO', text: 'The Serra de Tramuntana is a World Heritage landscape.' }
    ],
    story: 'Cut off from Palma by mountains until the railway arrived in 1912, Sóller traded its oranges directly with France, and its grand Modernista houses were built on that money. The valley still feels more Provençal than Spanish.'
  },
  {
    key: 'formentor',
    aliases: ['formentor', 'cap de formentor', 'platja de formentor', 'pollenca', 'pollença', 'port de pollenca', 'port de pollença', 'cala figuera de formentor'],
    name: 'Formentor',
    region: 'Mallorca, Spain',
    wiki: 'Cap de Formentor',
    lede: 'Mallorca’s wild northern tip: sheer cliffs dropping into deep blue water, a lighthouse at the end of the world, and a pine-shaded beach where the island’s glamour began.',
    picks: [
      { tag: 'Taxi · 25 min', level: 'Easy', title: 'Cap de Formentor lighthouse', text: 'The road twists along the ridge to the lighthouse. Stop at the Es Colomer viewpoint on the way for the classic cliff view.' },
      { tag: 'Swim', level: 'From the boat', title: 'Platja de Formentor', text: 'A long, sheltered beach backed by pines, with calm water and a view across the bay to Pollença.' },
      { tag: 'Taxi · 20 min', level: 'Moderate', title: 'Pollença’s 365 steps', text: 'Climb the cypress-lined Calvari steps in the old town for a view over the valley. Sunday morning brings a big market to the main square.' }
    ],
    eat: [
      { name: 'Port de Pollença promenade', note: 'Relaxed restaurants along the pine walk. Good for a long lunch.', badge: 'Lunch' },
      { name: 'Hotel Formentor terrace', note: 'The 1929 grand hotel above the beach, for a drink with history.', badge: 'Drinks' }
    ],
    know: [
      { label: 'Road access', text: 'In summer the cape road can be restricted to buses; ask the crew.' },
      { label: 'Bring', text: 'A layer for the lighthouse: it is windy at the cape.' },
      { label: 'Anchoring', text: 'Sand only off the beach, buoys in season.' },
      { label: 'Phone signal', text: 'Patchy on the cape.' }
    ],
    story: 'When the Hotel Formentor opened in 1929 it brought Chaplin, Grace Kelly and a generation of writers to a peninsula with no road. The engineer Antonio Parietti later carved the spectacular cape road along the ridge.'
  },
  {
    key: 'port-d-andratx',
    aliases: ['port d andratx', "port d'andratx", 'andratx', 'puerto de andratx'],
    name: 'Port d’Andratx',
    region: 'Mallorca, Spain',
    wiki: "Port d'Andratx",
    lede: 'A deep natural harbour ringed by villas, where fishing boats and superyachts share the quay and the sun sets straight down the bay.',
    picks: [
      { tag: 'Walk · 30 min', level: 'Easy', title: 'Harbour promenade at sunset', text: 'Walk the waterfront as the boats come in and the light turns gold. Find a terrace and order something cold.' },
      { tag: 'By tender · 20 min', level: 'Easy', title: 'Sant Elm and Sa Dragonera', text: 'A small beach village facing the dragon-shaped island. Swim, then cross to the nature park if time allows.' },
      { tag: 'Taxi · 25 min', level: 'Easy', title: 'Galatzó and Andratx old town', text: 'The old inland town keeps a weekly Wednesday market and a quiet, local feel.' }
    ],
    eat: [
      { name: 'Waterfront restaurants', note: 'Fresh fish and paella with views of the bay. Book ahead in summer.', badge: 'Evening' },
      { name: 'Cocktail bars', note: 'A string of bars along the quay for sundowners.', badge: 'Drinks' }
    ],
    know: [
      { label: 'Sunsets', text: 'The bay faces west: the best sunsets on Mallorca’s coast.' },
      { label: 'Shopping', text: 'Boutiques along the harbour, open late in summer.' },
      { label: 'Anchoring', text: 'Busy in season. The crew will choose the spot.' },
      { label: 'Phone signal', text: 'Good.' }
    ],
    story: 'Once a quiet fishing harbour, Port d’Andratx became the island’s chicest anchorage in the 1960s. Its fishermen still land their catch at the cooperative on the quay.'
  },
  {
    key: 'sa-dragonera',
    aliases: ['dragonera', 'sa dragonera', 'sant elm', 'cala llado', 'cala lladó'],
    name: 'Sa Dragonera',
    region: 'Mallorca, Spain',
    wiki: 'Sa Dragonera',
    lede: 'A dragon-shaped ridge of rock off Mallorca’s western tip, uninhabited, protected, and patrolled by thousands of lizards and soaring seabirds.',
    picks: [
      { tag: 'Walk · 1.5 h', level: 'Moderate', title: 'Na Pòpia lighthouse', text: 'The old lighthouse at the island’s high point, with views back to the Tramuntana. Start early: there is no shade.' },
      { tag: 'Walk · 45 min', level: 'Easy', title: 'Cap de Tramuntana', text: 'A gentler walk to the northern lighthouse along the spine of the island.' },
      { tag: 'Snorkel', level: 'Calm days', title: 'The channel', text: 'The strait between the island and Sant Elm is full of fish. Swim close to the rocks.' }
    ],
    eat: [
      { name: 'Sant Elm', note: 'Beach restaurants in the village opposite. No food on the island.', badge: 'Across the strait' },
      { name: 'Lunch aboard', note: 'The chef can pack a picnic for the walk.', badge: 'Aboard', menu: true }
    ],
    know: [
      { label: 'Nature park', text: 'Day visits only. Stay on marked paths.' },
      { label: 'Bring', text: 'Water, hat, walking shoes.' },
      { label: 'Landing', text: 'At Cala Lladó, where the park rangers are based.' },
      { label: 'Wildlife', text: 'Look for Eleonora’s falcons in late summer.' }
    ],
    story: 'Developers planned a resort here in the 1970s. Mallorcans occupied the island in protest, and in 1995 it became a natural park instead, one of the island’s great conservation victories.'
  },
  {
    key: 'es-trenc',
    aliases: ['es trenc', 'platja des trenc', 'colonia de sant jordi', 'colònia de sant jordi', 'ses covetes'],
    name: 'Es Trenc',
    region: 'Mallorca, Spain',
    wiki: 'Es Trenc',
    lede: 'Mallorca’s great wild beach: three kilometres of white sand and dunes with not a single building, over water so shallow and clear it looks Caribbean.',
    picks: [
      { tag: 'Swim', level: 'From the boat', title: 'The shallows', text: 'Float in waist-deep turquoise water over pure sand. The best colour is around midday.' },
      { tag: 'Walk · 45 min', level: 'Easy', title: 'The salt flats', text: 'Behind the dunes lie the Salines d’Es Trenc, where sea salt has been harvested since Roman times. Look for flamingos.' },
      { tag: 'By tender · 15 min', level: 'Easy', title: 'Colònia de Sant Jordi', text: 'A small fishing town with a pretty harbour and the visitor centre for Cabrera.' }
    ],
    eat: [
      { name: 'Beach chiringuitos', note: 'A few simple beach bars at the ends of the beach, open in season.', badge: 'Seasonal' },
      { name: 'Flor de sal', note: 'Pick up a jar of local flower of salt from the salt works: the perfect gift.', badge: 'Take home' }
    ],
    know: [
      { label: 'Anchoring', text: 'Clear sand: easy anchoring, no seagrass harmed.' },
      { label: 'Bring', text: 'Shade and water: there are no trees on the beach.' },
      { label: 'Wind', text: 'Open to the south: best in northerly weather.' },
      { label: 'Phone signal', text: 'Good.' }
    ],
    story: 'Es Trenc survived the building boom because the land behind it was salt works and farmland. Its protection was won by a long local campaign, and it remains the island’s largest undeveloped beach.'
  },
  {
    key: 'ibiza',
    aliases: ['ibiza', 'eivissa', 'ibiza town', 'marina ibiza', 'marina botafoch', 'dalt vila'],
    name: 'Ibiza',
    region: 'Balearic Islands, Spain',
    wiki: 'Ibiza (town)',
    lede: 'Far more than the party island: a walled hilltop old town above the harbour, long lunches on hidden beaches, and some of the clearest water in Europe.',
    picks: [
      { tag: 'Walk · 1 h', level: 'Moderate', title: 'Dalt Vila at dusk', text: 'Climb the Renaissance walls through the main gate to the cathedral square. The view over the harbour at sunset is worth every step.' },
      { tag: 'By tender', level: 'Easy', title: 'Es Vedrà at sunset', text: 'The mysterious limestone island off the west coast. See it from the water as the sun goes down behind it.' },
      { tag: 'Taxi · 25 min', level: 'Easy', title: 'Las Dalias market', text: 'The original hippy market at Sant Carles, on Saturdays. Linen, jewellery and a good people-watching café.' }
    ],
    eat: [
      { name: 'Beach-club lunch', note: 'Long lunches on the south-coast coves. Book well ahead in high season.', badge: 'Lunch' },
      { name: 'La Marina', note: 'The old harbour quarter below Dalt Vila: bars and boutiques open late.', badge: 'Evening' }
    ],
    know: [
      { label: 'UNESCO', text: 'Dalt Vila and the seagrass meadows are World Heritage.' },
      { label: 'Late nights', text: 'Dinner starts late here, often after 21:30.' },
      { label: 'Anchoring', text: 'Seagrass is protected. Use buoys or clear sand.' },
      { label: 'Taxis', text: 'Scarce in August. Ask the crew to book.' }
    ],
    story: 'Founded by Phoenicians around 654 BC, Ibiza grew rich on salt. The fortified upper town was built by Spain in the 16th century against Ottoman raids. The island’s free-spirited reputation began in the 1960s and never left.'
  },
  {
    key: 'formentera',
    aliases: ['formentera', 'ses illetes', 'illetes', 'la savina', 'platja de llevant', 'espalmador'],
    name: 'Formentera',
    region: 'Balearic Islands, Spain',
    wiki: 'Formentera',
    lede: 'A flat, sleepy island with the most famous water in the Mediterranean. At Ses Illetes a thin finger of white sand divides two seas of turquoise.',
    picks: [
      { tag: 'Swim', level: 'From the boat', title: 'Ses Illetes', text: 'Anchor off the sand spit and swim in water so clear the boat seems to float in air. Walk to the tip of the peninsula at the end of the day.' },
      { tag: 'By tender · 10 min', level: 'Easy', title: 'Espalmador', text: 'The private islet across the channel, with a beach of white sand and natural mud baths.' },
      { tag: 'Taxi · 25 min', level: 'Easy', title: 'Cap de Barbaria lighthouse', text: 'A lonely lighthouse on the cliffs at the island’s southern tip. Go for sunset.' }
    ],
    eat: [
      { name: 'Juan y Andrea', note: 'The legendary beach restaurant at Illetes, since 1971. Lobster, fish, rosé. Book ahead.', badge: 'Institution' },
      { name: 'Sant Francesc', note: 'The little capital: cafés around a fortified church.', badge: 'Village' }
    ],
    know: [
      { label: 'Anchoring', text: 'Strictly protected seagrass. Buoy fields in summer.' },
      { label: 'Getting around', text: 'Taxis are few. Many guests rent bikes or scooters.' },
      { label: 'Bring', text: 'Shade, water and reef-safe sunscreen.' },
      { label: 'Wind', text: 'Illetes is exposed in westerlies. The crew will judge.' }
    ],
    story: 'Formentera’s clear water is the work of the Posidonia seagrass: a single plant meadow here is thought to be among the oldest living things on earth. The meadows and the island’s salt ponds are protected as World Heritage.'
  },
  {
    key: 'mahon',
    aliases: ['mahon', 'mahón', 'mao', 'maó', 'port mahon', 'port mahón'],
    name: 'Mahón',
    region: 'Menorca, Spain',
    wiki: 'Mahón',
    lede: 'One of the great natural harbours of the world: five kilometres of sheltered water lined with Georgian sash windows, forts and islands, at the gateway to quiet, green Menorca.',
    picks: [
      { tag: 'By tender · 30 min', level: 'Easy', title: 'Cruise the harbour', text: 'Run the length of the harbour past the Lazareto quarantine island, the old naval base and La Mola fortress at the mouth.' },
      { tag: 'By tender · 10 min', level: 'Easy', title: 'Illa del Rei', text: 'An old British naval hospital on an island, now home to a contemporary art gallery and restaurant.' },
      { tag: 'Walk · 1 h', level: 'Easy', title: 'Old town and the cloister market', text: 'Climb the steps from the harbour into town. The fish market sits in a former cloister.' }
    ],
    eat: [
      { name: 'Harbourfront restaurants', note: 'Fish and seafood along the quay below the old town.', badge: 'Evening' },
      { name: 'Menorcan gin', note: 'A legacy of the British. Try a pomada, gin with lemonade, the local way.', badge: 'Drinks' },
      { name: 'Caldereta de langosta', note: 'Lobster stew, the island’s great dish. Best in Fornells on the north coast.', badge: 'Must try' }
    ],
    know: [
      { label: 'Language', text: 'Menorquí (Catalan) and Spanish.' },
      { label: 'Pace', text: 'Quieter than Mallorca and Ibiza. Shops close for a long lunch.' },
      { label: 'Walking', text: 'The Camí de Cavalls footpath circles the whole island.' },
      { label: 'Biosphere', text: 'All of Menorca is a UNESCO Biosphere Reserve.' }
    ],
    story: 'Britain held Menorca for most of the 18th century and made Mahón its Mediterranean naval base; the sash windows and gin are souvenirs of that time. Legend says mayonnaise, “sauce mahonnaise”, was born here after the French captured the town in 1756.'
  },
  {
    key: 'ciutadella',
    aliases: ['ciutadella', 'ciudadela', 'ciutadella de menorca'],
    name: 'Ciutadella',
    region: 'Menorca, Spain',
    wiki: 'Ciutadella de Menorca',
    lede: 'Menorca’s old capital: a narrow fjord of a harbour, golden stone palaces, arcaded streets and a quiet elegance that comes alive after dark.',
    picks: [
      { tag: 'Walk · 1 h', level: 'Easy', title: 'Old town loop', text: 'From the harbour up to the cathedral, along the arcades of Ses Voltes and into the Plaça des Born.' },
      { tag: 'By tender · 30 min', level: 'Easy', title: 'Cala Macarella', text: 'Twin coves of white sand and pine on the south coast. Arrive early or late to beat the crowds.' },
      { tag: 'Walk · 20 min', level: 'Easy', title: 'Sunset at Castell de Sant Nicolau', text: 'The little watchtower at the harbour mouth is the town’s sunset spot.' }
    ],
    eat: [
      { name: 'Harbour restaurants', note: 'Seafood terraces lining the narrow port.', badge: 'Evening' },
      { name: 'Ensaïmada and pastries', note: 'Old bakeries in the old town do the best breakfast.', badge: 'Morning' }
    ],
    know: [
      { label: 'Rissaga', text: 'The harbour can surge suddenly in certain weather. The crew watch for it.' },
      { label: 'Sant Joan', text: 'In late June, horses and riders fill the streets for a famous festival.' },
      { label: 'Siesta', text: 'Shops close in the afternoon and reopen in the evening.' },
      { label: 'Language', text: 'Menorquí (Catalan) and Spanish.' }
    ],
    story: 'Ciutadella was Menorca’s capital until the British moved it to Mahón. The Ottoman sack of 1558 destroyed much of the town; what you see today was rebuilt by noble families who never left.'
  },
  {
    key: 'cala-macarella',
    aliases: ['cala macarella', 'macarella', 'macarelleta', 'cala macarelleta'],
    name: 'Cala Macarella',
    region: 'Menorca, Spain',
    wiki: 'Cala Macarella',
    lede: 'Two of the most beautiful coves in the Balearics side by side: white sand, pine-covered cliffs and water in every shade of turquoise.',
    picks: [
      { tag: 'Swim', level: 'From the boat', title: 'Anchor between the coves', text: 'Swim ashore to Macarella, then around the point to its little sister, Macarelleta.' },
      { tag: 'Walk · 40 min', level: 'Easy', title: 'Camí de Cavalls to Cala Turqueta', text: 'The coastal path through the pines to another perfect cove to the east.' },
      { tag: 'Snorkel', level: 'Easy', title: 'Along the cliffs', text: 'The rocks either side of the cove are full of fish.' }
    ],
    eat: [
      { name: 'Beach restaurant', note: 'A simple restaurant behind the main beach, open in season.', badge: 'Seasonal' },
      { name: 'Lunch aboard', note: 'Best enjoyed at anchor with the view.', badge: 'Aboard', menu: true }
    ],
    know: [
      { label: 'Crowds', text: 'Busy from late morning in summer. Early and late are magical.' },
      { label: 'Anchoring', text: 'Sand only. Seagrass is protected.' },
      { label: 'Bring', text: 'Water shoes for the rocky edges.' },
      { label: 'Phone signal', text: 'Weak in the cove.' }
    ],
    story: 'The south coast of Menorca is cut by ravines that run down to the sea and end in coves like this one. The land behind belongs to old estates, which is why the coast has stayed so wild.'
  }
];

// Practical basics by country, used when a stop has no written guide.
export const COUNTRY_BASICS = {
  Spain: [
    { label: 'Money', text: 'Euro. Cards everywhere; some beach bars are cash only.' },
    { label: 'Eating times', text: 'Lunch 13:30–15:30, dinner from 20:30.' },
    { label: 'Tipping', text: 'Round up, or 5–10% for good service.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  France: [
    { label: 'Money', text: 'Euro. Cards widely accepted.' },
    { label: 'Eating times', text: 'Lunch 12:00–14:00, dinner from 19:30. Kitchens close between.' },
    { label: 'Tipping', text: 'Service is included; leave a little extra for good service.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Monaco: [
    { label: 'Money', text: 'Euro.' },
    { label: 'Dress', text: 'Smart in the casino and hotel bars.' },
    { label: 'Tipping', text: 'Service usually included.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Italy: [
    { label: 'Money', text: 'Euro. Small places may prefer cash.' },
    { label: 'Eating times', text: 'Lunch 12:30–14:30, dinner from 19:30.' },
    { label: 'Churches', text: 'Cover shoulders and knees to go inside.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Greece: [
    { label: 'Money', text: 'Euro. Tavernas on islands often prefer cash.' },
    { label: 'Eating times', text: 'Late: dinner from 21:00 is normal.' },
    { label: 'Churches', text: 'Cover shoulders and knees.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Croatia: [
    { label: 'Money', text: 'Euro (since 2023).' },
    { label: 'Old towns', text: 'Swimwear is not allowed in old town streets.' },
    { label: 'Tipping', text: 'Around 10% for good service.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Montenegro: [
    { label: 'Money', text: 'Euro, though not in the EU.' },
    { label: 'Mobile data', text: 'Outside the EU: roaming charges may apply.' },
    { label: 'Tipping', text: 'Around 10%.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Malta: [
    { label: 'Money', text: 'Euro.' },
    { label: 'Language', text: 'Maltese and English.' },
    { label: 'Driving', text: 'On the left.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Turkey: [
    { label: 'Money', text: 'Turkish lira. Cards widely accepted.' },
    { label: 'Mosques', text: 'Cover shoulders and knees; women cover hair.' },
    { label: 'Mobile data', text: 'Outside the EU: roaming charges apply.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Cyprus: [
    { label: 'Money', text: 'Euro.' },
    { label: 'Driving', text: 'On the left.' },
    { label: 'Language', text: 'Greek and English widely spoken.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Gibraltar: [
    { label: 'Money', text: 'Gibraltar or British pound. Euros often accepted at poor rates.' },
    { label: 'Mobile data', text: 'Outside the EU: roaming charges may apply.' },
    { label: 'Monkeys', text: 'Don’t feed the Barbary macaques; keep bags closed.' },
    { label: 'Emergency', text: 'Dial 112.' }
  ],
  Tunisia: [
    { label: 'Money', text: 'Tunisian dinar, cash. Cannot be taken out of the country.' },
    { label: 'Dress', text: 'Modest dress away from beaches.' },
    { label: 'Mobile data', text: 'Roaming charges apply.' },
    { label: 'Emergency', text: 'Police 197, ambulance 190.' }
  ]
};

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function slugFor(stop) {
  return stop.port_id || norm(stop.name).replace(/ /g, '-').replace(/'/g, '');
}

// Finds the written guide for a stop by port id, name, or a known alias inside the name.
export function findGuide(stop) {
  if (!stop) return null;
  if (stop.port_id) {
    const byId = GUIDES.find((g) => g.key === stop.port_id);
    if (byId) return byId;
  }
  const n = norm(stop.name);
  return (
    GUIDES.find((g) => g.aliases.some((a) => norm(a) === n)) ||
    GUIDES.find((g) => g.aliases.some((a) => norm(a).length > 4 && n.includes(norm(a)))) ||
    null
  );
}
