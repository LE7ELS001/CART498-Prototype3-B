export const areas = [
  { id:'westmount', name:'Westmount Park', distance:650, traffic:'High', facilities:['Power Outlet','Shelter'], photo:'park.png', point:[-73.5982,45.4813], address:'327 Av. Melville, Westmount, Quebec H3Z 2J7' },
  { id:'victoria', name:'Victoria Square', distance:1000, traffic:'Medium', facilities:['Shelter'], photo:'square.png', point:[-73.562,45.501], address:'Square Victoria, Montréal, Quebec' },
  { id:'saint-louis', name:'Square Saint-Louis', distance:1800, traffic:'Low', facilities:['Seating'], point:[-73.569,45.517], address:'Square Saint-Louis, Montréal, Quebec' },
];

export const performanceLocations = areas.slice(0,2);

export const shows = [
  { id:'hubble', name:'Hubble-Lemaître', genre:'Guitar', time:'14:00 - 16:00', remaining:41, audience:23, distance:650, area:areas[0], photo:'guitar-cover', avatar:'guitar-avatar', track:'Starlight' },
  { id:'newton', name:'Isaac Newton', genre:'Keyboard', time:'21:00 - 21:30', remaining:20, audience:12, distance:350, area:areas[1], photo:'keyboard-cover', avatar:'keyboard-avatar', track:'Moonlight' },
  { id:'kepler', name:'Johannes Kepler', genre:'Saxophone', time:'21:00 - 21:30', remaining:10, audience:7, distance:350, area:areas[2], photo:'sax-cover', avatar:'sax-avatar', track:'Night Walk' },
];

export const categories = ['Guitar','Saxophone','Accordion','Keyboard'];
export const filterLabels = {
  audience:['Category','Time Left','Distance'],
  performer:['Distance','Facilities','Foot Traffic']
};
export const distance = value => value < 1000 ? value + 'm' : value / 1000 + ' km';
export const clock = value => new Date(value).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
export const day = value => new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
