# Deploy

- Prod build **Dokploy nixpacks** ile yapılır (`pnpm build` → `next start`); Dockerfile yoktur.
  Repodaki `docker-compose.yml` yalnız yerel geliştirme ortamı içindir, prod imajı üretmez.
- Sağlık ucu: `GET /healthz`. Postgres erişilebilirse `200 {"status":"ok"}`; erişilemezse
  veya yanıt 2 sn'yi aşarsa `503 {"status":"db_unreachable"}` döner. Dokploy healthcheck bu
  yola bağlanabilir.
