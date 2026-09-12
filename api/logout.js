// api/logout.js
export default function handler(req, res) {
  res.setHeader(
    'Set-Cookie',
    'invitta_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  );
  return res.status(200).json({ ok: true });
}
