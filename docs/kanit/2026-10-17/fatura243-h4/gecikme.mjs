// Aralıklı EŞZAMANLI iş (min–maks ms): bulunduğu sürecin olay döngüsünü bloklar (zorla ön koşul, ders 20).
export function lagLoop(spec, alive = () => true) {
  const [min, max] = String(spec).split("-").map(Number);
  const busy = ms => {
    const end = Date.now() + ms;
    while (Date.now() < end);
  };
  const tick = () => {
    if (!alive()) return;
    busy(min + Math.random() * (max - min));
    setTimeout(tick, 200 + Math.random() * 800);
  };
  setTimeout(tick, 1000);
}
