export const ALGERIA_BRANDS = [
  'Renault', 'Dacia', 'Peugeot', 'Citroën', 'Toyota', 'Hyundai', 'Kia',
  'Volkswagen', 'Mercedes', 'BMW', 'Audi', 'Fiat', 'Opel', 'Nissan', 'Honda',
  'Suzuki', 'Mitsubishi', 'DFSK', 'Chery', 'Geely', 'BYD', 'MG', 'Autre',
] as const

export type Brand = (typeof ALGERIA_BRANDS)[number]

export const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015] as const

export const MODELS_BY_BRAND: Record<Brand, string[]> = {
  Renault:    ['Clio', 'Symbol', 'Megane', 'Captur', 'Kadjar', 'Kangoo', 'Express', 'Trafic', 'Autre'],
  Dacia:      ['Sandero', 'Logan', 'Stepway', 'Duster', 'Lodgy', 'Dokker', 'Autre'],
  Peugeot:    ['208', '301', '2008', '3008', '5008', 'Partner', 'Expert', 'Autre'],
  Citroën:    ['C3', 'C-Elysée', 'C4', 'Berlingo', 'Jumpy', 'Autre'],
  Toyota:     ['Yaris', 'Corolla', 'RAV4', 'Hilux', 'Land Cruiser', 'Fortuner', 'Autre'],
  Hyundai:    ['i10', 'i20', 'Accent', 'Elantra', 'Tucson', 'Creta', 'Santa Fe', 'Autre'],
  Kia:        ['Picanto', 'Rio', 'Cerato', 'Sportage', 'Sorento', 'Seltos', 'Autre'],
  Volkswagen: ['Polo', 'Golf', 'Passat', 'Tiguan', 'Touareg', 'Caddy', 'Autre'],
  Mercedes:   ['Classe A', 'Classe C', 'Classe E', 'GLA', 'GLC', 'GLE', 'Sprinter', 'Autre'],
  BMW:        ['Série 1', 'Série 3', 'Série 5', 'X1', 'X3', 'X5', 'Autre'],
  Audi:       ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7', 'Autre'],
  Fiat:       ['500', 'Panda', 'Tipo', 'Doblo', 'Ducato', 'Autre'],
  Opel:       ['Corsa', 'Astra', 'Mokka', 'Grandland', 'Combo', 'Autre'],
  Nissan:     ['Micra', 'Sunny', 'Qashqai', 'X-Trail', 'Navara', 'Autre'],
  Honda:      ['Civic', 'Accord', 'CR-V', 'HR-V', 'Autre'],
  Suzuki:     ['Swift', 'Baleno', 'Vitara', 'Jimny', 'S-Cross', 'Autre'],
  Mitsubishi: ['Lancer', 'Outlander', 'ASX', 'L200', 'Pajero', 'Autre'],
  DFSK:       ['Glory 500', 'Glory 580', 'K01', 'K05', 'Mini Truck', 'Autre'],
  Chery:      ['Tiggo 2', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8', 'Arrizo 5', 'Autre'],
  Geely:      ['Emgrand', 'Coolray', 'Atlas', 'Tugella', 'Autre'],
  BYD:        ['Dolphin', 'Atto 3', 'Seal', 'Song', 'Han', 'Autre'],
  MG:         ['MG3', 'MG5', 'ZS', 'HS', 'RX5', 'Autre'],
  Autre:      ['Autre'],
}
