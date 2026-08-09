import fetch from 'node-fetch';
(async () => {
  const res = await fetch('http://localhost:3000/api/services?_t=' + Date.now());
  console.log(res.status, res.statusText);
  if (!res.ok) console.log(await res.text());
})();
