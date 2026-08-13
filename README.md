# NEXUS 2040: Ghost Grid

Tek oyunculu, sunucu otoriteli PvE strateji simülasyonu. Geliştirme kapsamı ve faz durumunun kaynağı [GAME_PLAN.md](GAME_PLAN.md) dosyasıdır.

## Yerelde başlatma

Önkoşullar: Docker Desktop, Node.js 24.x ve pnpm 11.x.

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env # isteğe bağlı yerel port/kimlik bilgisi değişikliği
pnpm services:up
pnpm --filter @nexus/api run migrate
pnpm services:check
pnpm verify
```

Üç ayrı terminalde geliştirme süreçlerini çalıştırın:

```powershell
pnpm --filter @nexus/web exec vite
pnpm --filter @nexus/api run start
pnpm --filter @nexus/worker run start
```

API ve worker liveness yüzeyini doğrulayın:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3001/health
```

Tanılama ve kapanış:

```powershell
pnpm services:logs
pnpm services:down
```

`services:down` kapsayıcıları ve ağı kaldırır, ancak named volume'ları silmez. `.env.example` yalnız sentetik yerel değerler içerir; gerçek sırları `.env` içinde tutun ve commit etmeyin. Servis, migration ve entegrasyon komutları kökteki `.env` dosyasını okur; `POSTGRES_PORT`/kimlik bilgisi değiştirirseniz `DATABASE_URL` değerini aynı ayarla güncelleyin. PostgreSQL kullanıcı/parola/veritabanı değerleri yalnız boş volume ilk kez hazırlanırken uygulanır; bunları sonradan değiştirmek yerel PostgreSQL volume'unu silip tüm yerel veriyi sıfırlamayı gerektirir. PostgreSQL varsayılan olarak yalnız `127.0.0.1:15432`, Redis yalnız `127.0.0.1:16379` üzerinden açılır. API/worker varsayılan portları `3000`/`3001`'dir; `API_PORT` ve `WORKER_PORT` ile değiştirilebilir.

## Komut sözleşmesi

| Komut | Amaç |
|---|---|
| `pnpm lint` | Kaynak lint'i. |
| `pnpm typecheck` | Tüm workspace TypeScript denetimi. |
| `pnpm test` | Birim, fixture ve HTTP smoke kontrolleri. |
| `pnpm test:integration` | PostgreSQL/Redis ve migration entegrasyonu; servisler açık olmalı. |
| `pnpm test:e2e` | Henüz planlı, açık no-op. |
| `pnpm balance:check` | Henüz planlı, açık no-op. |
| `pnpm plan:check` | Plan tutarlılığı. |
| `pnpm verify` | Mevcut zorunlu kapıların tamamı; entegrasyon servisleri açık olmalı. |
