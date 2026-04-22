# Auth Testing Playbook

## MongoDB Verification
```bash
mongosh
use <database_name>
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```

Verifikasi:
- hash bcrypt diawali `$2b$`
- index tersedia pada `users.email` (unique), `login_attempts.identifier`, `password_reset_tokens.expires_at` (TTL)

## API Testing
```bash
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"admin123"}'
cat cookies.txt
curl -b cookies.txt http://localhost:8001/api/auth/me
```

Ekspektasi:
- login mengembalikan object user dan menetapkan cookie `access_token` + `refresh_token`
- endpoint `/me` mengembalikan user yang sama menggunakan cookie tersebut