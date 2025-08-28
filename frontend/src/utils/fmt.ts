export const fmtKm = (m?: number | null) =>
    m ? (m / 1000).toFixed(2) + " км" : "—";
  
  export const fmtMin = (sec?: number | null) =>
    sec ? Math.floor(sec / 60) + " мин" : "—";
  