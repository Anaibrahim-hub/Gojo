export interface LocalPlace {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
}

export const LOCAL_PLACES: LocalPlace[] = [
  // Addis Ababa neighborhoods
  { id: 'local-addis-ababa', text: 'Addis Ababa', place_name: 'Addis Ababa, Ethiopia', center: [38.7578, 9.0320], place_type: ['place'] },
  { id: 'local-bole', text: 'Bole', place_name: 'Bole, Addis Ababa, Ethiopia', center: [38.7912, 9.0008], place_type: ['neighborhood'] },
  { id: 'local-cmc', text: 'CMC', place_name: 'CMC, Addis Ababa, Ethiopia', center: [38.8074, 9.0352], place_type: ['neighborhood'] },
  { id: 'local-kazanchis', text: 'Kazanchis', place_name: 'Kazanchis, Addis Ababa, Ethiopia', center: [38.7783, 9.0192], place_type: ['neighborhood'] },
  { id: 'local-gerji', text: 'Gerji', place_name: 'Gerji, Addis Ababa, Ethiopia', center: [38.8099, 9.0142], place_type: ['neighborhood'] },
  { id: 'local-sarbet', text: 'Sarbet', place_name: 'Sarbet, Addis Ababa, Ethiopia', center: [38.7553, 8.9882], place_type: ['neighborhood'] },
  { id: 'local-old-airport', text: 'Old Airport', place_name: 'Old Airport, Addis Ababa, Ethiopia', center: [38.7737, 8.9917], place_type: ['neighborhood'] },
  { id: 'local-megenagna', text: 'Megenagna', place_name: 'Megenagna, Addis Ababa, Ethiopia', center: [38.8020, 9.0229], place_type: ['neighborhood'] },
  { id: 'local-piassa', text: 'Piassa', place_name: 'Piassa, Addis Ababa, Ethiopia', center: [38.7471, 9.0302], place_type: ['neighborhood'] },
  { id: 'local-arat-kilo', text: 'Arat Kilo', place_name: 'Arat Kilo, Addis Ababa, Ethiopia', center: [38.7602, 9.0441], place_type: ['neighborhood'] },
  { id: 'local-sidist-kilo', text: 'Sidist Kilo', place_name: 'Sidist Kilo, Addis Ababa, Ethiopia', center: [38.7642, 9.0398], place_type: ['neighborhood'] },
  { id: 'local-meskel-square', text: 'Meskel Square', place_name: 'Meskel Square, Addis Ababa, Ethiopia', center: [38.7650, 8.9956], place_type: ['neighborhood'] },
  { id: 'local-bole-medhanialem', text: 'Bole Medhanialem', place_name: 'Bole Medhanialem, Addis Ababa, Ethiopia', center: [38.7988, 9.0012], place_type: ['neighborhood'] },
  { id: 'local-lafto', text: 'Lafto', place_name: 'Lafto, Addis Ababa, Ethiopia', center: [38.7495, 8.9543], place_type: ['neighborhood'] },
  { id: 'local-kolfe', text: 'Kolfe', place_name: 'Kolfe, Addis Ababa, Ethiopia', center: [38.7231, 9.0123], place_type: ['neighborhood'] },
  { id: 'local-gotera', text: 'Gotera', place_name: 'Gotera, Addis Ababa, Ethiopia', center: [38.7659, 8.9873], place_type: ['neighborhood'] },
  { id: 'local-akaki', text: 'Akaki', place_name: 'Akaki, Addis Ababa, Ethiopia', center: [38.7965, 8.8818], place_type: ['neighborhood'] },
  { id: 'local-urael', text: 'Urael', place_name: 'Urael, Addis Ababa, Ethiopia', center: [38.7786, 9.0134], place_type: ['neighborhood'] },
  { id: 'local-mexico', text: 'Mexico', place_name: 'Mexico, Addis Ababa, Ethiopia', center: [38.7468, 9.0054], place_type: ['neighborhood'] },
  { id: 'local-jemo', text: 'Jemo', place_name: 'Jemo, Addis Ababa, Ethiopia', center: [38.7160, 8.9732], place_type: ['neighborhood'] },
  { id: 'local-summit', text: 'Summit', place_name: 'Summit, Addis Ababa, Ethiopia', center: [38.8124, 9.0184], place_type: ['neighborhood'] },
  { id: 'local-ayat', text: 'Ayat', place_name: 'Ayat, Addis Ababa, Ethiopia', center: [38.8388, 9.0340], place_type: ['neighborhood'] },
  { id: 'local-lebu', text: 'Lebu', place_name: 'Lebu, Addis Ababa, Ethiopia', center: [38.7214, 8.9648], place_type: ['neighborhood'] },
  { id: 'local-22', text: '22', place_name: '22, Addis Ababa, Ethiopia', center: [38.7850, 9.0395], place_type: ['neighborhood'] },
  { id: 'local-bole-bulbula', text: 'Bole Bulbula', place_name: 'Bole Bulbula, Addis Ababa, Ethiopia', center: [38.8250, 8.9580], place_type: ['neighborhood'] },
  { id: 'local-lideta', text: 'Lideta', place_name: 'Lideta, Addis Ababa, Ethiopia', center: [38.7430, 9.0078], place_type: ['neighborhood'] },
  { id: 'local-arada', text: 'Arada', place_name: 'Arada, Addis Ababa, Ethiopia', center: [38.7510, 9.0358], place_type: ['neighborhood'] },
  { id: 'local-kirkos', text: 'Kirkos', place_name: 'Kirkos, Addis Ababa, Ethiopia', center: [38.7590, 9.0108], place_type: ['neighborhood'] },
  { id: 'local-gulele', text: 'Gulele', place_name: 'Gulele, Addis Ababa, Ethiopia', center: [38.7468, 9.0572], place_type: ['neighborhood'] },
  { id: 'local-nifassilk-lafto', text: 'Nifas Silk Lafto', place_name: 'Nifas Silk Lafto, Addis Ababa, Ethiopia', center: [38.7575, 8.9680], place_type: ['neighborhood'] },
  // Major Ethiopian cities
  { id: 'local-dire-dawa', text: 'Dire Dawa', place_name: 'Dire Dawa, Ethiopia', center: [41.8661, 9.5929], place_type: ['place'] },
  { id: 'local-mekelle', text: 'Mekelle', place_name: 'Mekelle, Ethiopia', center: [39.4767, 13.4967], place_type: ['place'] },
  { id: 'local-gondar', text: 'Gondar', place_name: 'Gondar, Ethiopia', center: [37.4669, 12.6089], place_type: ['place'] },
  { id: 'local-hawassa', text: 'Hawassa', place_name: 'Hawassa, Ethiopia', center: [38.4779, 7.0549], place_type: ['place'] },
  { id: 'local-bahir-dar', text: 'Bahir Dar', place_name: 'Bahir Dar, Ethiopia', center: [37.3614, 11.5742], place_type: ['place'] },
  { id: 'local-jimma', text: 'Jimma', place_name: 'Jimma, Ethiopia', center: [36.8313, 7.6698], place_type: ['place'] },
  { id: 'local-adama', text: 'Adama', place_name: 'Adama, Ethiopia', center: [39.2676, 8.5400], place_type: ['place'] },
  { id: 'local-dessie', text: 'Dessie', place_name: 'Dessie, Ethiopia', center: [39.6340, 11.1340], place_type: ['place'] },
  { id: 'local-shashamane', text: 'Shashamane', place_name: 'Shashamane, Ethiopia', center: [38.5985, 7.2003], place_type: ['place'] },
];

export function filterLocalPlaces(query: string): LocalPlace[] {
  const q = query.toLowerCase().trim();
  if (q.length < 1) return [];
  const startsWith = LOCAL_PLACES.filter(p => p.text.toLowerCase().startsWith(q));
  const contains = LOCAL_PLACES.filter(p => !p.text.toLowerCase().startsWith(q) && p.text.toLowerCase().includes(q));
  return [...startsWith, ...contains].slice(0, 4);
}
