/** One owner for document.title so the page name and the "(3)" pending-KYC badge never fight. */
let base = 'Prila Admin';
let badge = 0;

function apply() {
  document.title = `${badge > 0 ? `(${badge > 99 ? '99+' : badge}) ` : ''}${base}`;
}

export function setBaseTitle(title: string) {
  base = title;
  apply();
}

export function setTitleBadge(n: number) {
  badge = n;
  apply();
}
