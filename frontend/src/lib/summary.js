// Small helpers on top of GET /summary.
export const screenOf = (d) => d.tv_s + d.tablet_s + d.phone_s + d.multi_screen_s;
export const avg = (list, fn) => (list.length ? list.reduce((s, d) => s + fn(d), 0) / list.length : 0);
export const dateOf = (iso) => new Date(`${iso}T12:00:00`);
export const isWeekend = (iso) => [5, 6].includes(dateOf(iso).getDay()); // Friday and Saturday
