# P1 Yaşam Döngüsü Test Raporu

## Kimlik

| Alan | Değer |
|---|---|
| Mod | `phase-regression` |
| Faz | Faz 1 — Teknik temel |
| Commit/build | `aa408893cea0dc25a3a949307405fadf9495ec75` (`aa40889`), üstünde commitlenmemiş P1 kapanış düzeltmeleri: `apps/api/scripts/migrations-integration.ts`, `apps/web/package.json`, `package.json`, `scripts/web-smoke.mjs` |
| Formül/içerik sürümü | `balance-1.2` / `asteria-baseline-0.2` |
| Ortam | Windows; Node `v24.16.0`; pnpm `11.19.0`; Python `3.14.5`; Docker Engine `29.6.2`; PostgreSQL `17.7-alpine`; Redis `7.4.3-alpine` |
| Seed/fixture | PCG32 `20260809` / `golden`, `operation:test-17:success`, `operation:test-17:detection`; izole `nexus_migration_test`; disposable profile `b4038079-4191-4e84-bf02-4ac16b5c027c` |
| Tarih ve ajan | 2026-08-14 UTC, `lifecycle_game_tester` |

## Kapsam ve yolculuklar

| Yolculuk/invariant | Beklenen gözlenebilir davranış | Sonuç | Kanıt |
|---|---|---|---|
| Temiz bağımlılık çözümü ve komut sözleşmesi | Kilit dosyasıyla çalışma alanı çözümlenir; Faz 1'in sekiz kök kalite komutu kullanılabilir olur. | PASS | `pnpm install --frozen-lockfile` exit `0`; `pnpm verify` tüm girişleri çağırdı. |
| Web başlangıç/liveness | Web production shell derlenir ve liveness denetimi geçer. | PASS | `pnpm verify` içindeki Vite build ve `scripts/web-smoke.mjs`: `PASS: web production shell liveness verified.` |
| API ve worker sağlık/retry | Her iki liveness yüzeyi, güvenli request correlation, public error ve yapılandırılmış log sözleşmesi iki ayrı denemede korunur; test bitince port kalmaz. | PASS | İki ardışık `pnpm exec node scripts/http-smoke.mjs` exit `0`; kök `pnpm test` ve son `pnpm verify` exit `0`. |
| Yeni ve dönen profil kalıcılığı | Yeni profilin sürüm çiftleri PostgreSQL'de kalır; PostgreSQL/Redis yeniden başlatılınca tekrar okunur; disposable veri temizlenir. | PASS | Geçici profil ve `lifecycle:p1:phase-regression` anahtarı yazıldı; `docker compose ... restart postgres redis` sonrası profile satırı ve `retained` anahtarı okundu; ardından `DELETE 1` ve `DEL 1`. |
| PostgreSQL sistem kaydı / Redis geçici sınırı | Kalıcı profile şeması ve ledger/idempotency denetimleri PostgreSQL'de yürür; Redis sağlık/yeniden başlatma yalnız geçici test anahtarıyla doğrulanır. | PASS | `pnpm test:integration` exit `0`; migration runner'ın profil, sürüm, ledger ve idempotency denetimleri geçti. Servis check PostgreSQL + Redis için healthy döndü. |
| Migration ileri/geri, tekrar ve kurtarma | Boş izole veritabanında ileri → geri → ileri ve tekrar ileri güvenlidir; kalıcı ledger varken geri alma veri kaybını reddeder. | PASS | `pnpm --filter @nexus/api run migrate` iki kez `Applied: none`, exit `0`; `pnpm test:integration` exit `0`. |
| İdempotency ve invalid/boundary giriş | Aynı anahtarın ardışık ve eşzamanlı tekrarında tam bir kayıt kalır; sıfır ve kesirli mikro-birim reddedilir; immutable ledger silinemez/boşaltılamaz. | PASS | Son entegrasyon çıktısı: `sequential/concurrent idempotency, immutable ledger, and rollback guard verified`; PostgreSQL logları duplicate, `DELETE`, `TRUNCATE` ve veri varken rollback reddini gösterdi. |
| Deterministik seed ve runtime portları | Sabit saat/UUID hata yolu fail-closed'dur; TypeScript ve Python PCG32 fixture'ları, golden vektörler ve olasılık eşikleri eşleşir. | PASS | Contracts, simulation ve Python fixture denetimleri `pnpm test`/`pnpm verify` içinde geçti; ayrı komutlar da exit `0`. |
| Servis yaşam döngüsü | Sağlıklı servisler açılır, doğrulama süresince kalır, `services:down` sonrası konteyner/ağ kaldırılır fakat named volume korunur. | PASS | Stabil zincir `pnpm services:up → pnpm verify → pnpm services:down` sırasıyla exit `0, 0, 0`; son Compose `ps -a` boştu. Önceki veritabanı volume'u bir sonraki `services:up` içinde yeniden kullanıldı ve recovery denetimi geçti. |
| CI zorunlu kapıları | Workflow lint, typecheck, unit ve integration kapılarını zorunlu tutar. | PASS | `pnpm verify` içindeki CI contract check geçti; ayrı `pnpm lint` ve `pnpm typecheck` exit `0`. Uzak CI/branch-protection yeniden değiştirilmedi; P1.7 kanıtı korunuyor. |

## Komutlar

| Komut | Exit code | Özet |
|---|---:|---|
| `py -3 .agents/skills/verify-game-phase/scripts/validate_plan.py GAME_PLAN.md` | 0 | 11 faz, 83 görev, 17 tamamlanmış görev, 16 karar doğrulandı. |
| `pnpm install --frozen-lockfile` | 0 | 8 workspace projesi kilit dosyasına göre çözümlendi. |
| `pnpm lint` | 0 | ESLint uyarısız tamamlandı. |
| `pnpm typecheck` | 0 | Yedi TypeScript paketi geçti. |
| `pnpm --filter @nexus/contracts run test` | 0 | Sabit clock/UUID ve fail-closed sınırları geçti. |
| `pnpm --filter @nexus/simulation run test` | 0 | PCG32 golden vektörleri, stream izolasyonu ve olasılık eşikleri geçti. |
| `py -3 tools/verify_pcg_fixture.py` | 0 | Python, ortak canonical fixture'ı doğruladı. |
| `pnpm exec node scripts/http-smoke.mjs` (iki ardışık tur) | 0 / 0 | API/worker health, correlation, public hata ve log sözleşmesi iki kez geçti. |
| `pnpm services:up` | 0 | PostgreSQL ve Redis healthy durumuna geldi. |
| `pnpm services:check` | 0 | İki yerel bağımlılık healthy bulundu. |
| `pnpm --filter @nexus/api run migrate` (iki tur) | 0 / 0 | İdempotent tekrar: `Applied: none`. |
| `pnpm test:integration` (iki tur) | 0 / 0 | Migration, sürüm sabitleme, ardışık/eşzamanlı idempotency, immutable ledger ve rollback guard geçti. |
| `pnpm test:e2e` | 0 | Açıkça `DEFERRED`: Faz 1'de oyuncu arayüzü akışı henüz yok. |
| `pnpm balance:check` | 0 | Açıkça `DEFERRED`: değişmemiş onaylı denge baseline'ı. |
| `pnpm plan:check` | 0 | Plan tutarlılığı geçti. |
| `pnpm verify` | 0 | Lint, typecheck, unit/fixture/web/API-worker, integration, deferred E2E/balance ve plan kontrollerinin tamamı geçti. |
| `pnpm services:logs` | 0 | Beklenen idempotency, immutable ledger ve rollback reddi logları görüldü; beklenmeyen servis hatası yok. |
| `docker compose -f infra/docker-compose.yml restart postgres redis` | 0 | İki servis yeniden başladı. |
| Disposable profile/Redis write → restart → read → cleanup | 0 | Profil sürüm satırı ve sentetik geçici anahtar tutuldu; ikisi test sonunda silindi. |
| `pnpm services:down` ve `docker compose -f infra/docker-compose.yml ps -a` | 0 / 0 | Konteynerler/ağ kaldırıldı; Compose listesi boş. |

## Bulgular ve regresyonlar

| Kimlik | Şiddet | Yeniden üretim | Beklenen/gerçek | Durum |
|---|---|---|---|---|
| Yok | — | Stabil test penceresinde P0/P1 bulgusu gözlenmedi. | Faz 1 çıkış kapıları ve zorunlu kontroller gözlenen davranışta sağlandı. | Kapalı |

Not: Stabil pencere öncesindeki bir `pnpm verify` denemesi, başka test çalışmasının Compose konteynerlerini kaldırması nedeniyle `postgres not running` ile exit `1` oldu. Aynı build, izole/stabil pencerede yukarıdaki `services:up → verify → services:down` zincirinde exit `0` verdi; bu nedenle ürün kusuru olarak sınıflandırılmadı.

## Atlanan veya kullanılamayan kontroller

- Tarayıcıda tam oyuncu profil/ekonomi/operasyon E2E yolculuğu `NOT VERIFIED`: Faz 1 yalnız teknik temel kurar; oyuncuya oynanabilir stratejik/operasyon akışı sonraki fazların kapsamıdır. `test:e2e` bu nedenle açık bir deferred no-op'tur.
- Klavye, odak, renk-bağımsız anlam ve reduced-motion `NOT VERIFIED`: Faz 1'in kalıcı oyuncu UI'sı yoktur; web shell liveness doğrulandı, erişilebilirlik kapısı Faz 7/release kapsamındadır.
- Benchmark API yükü, worker tekrar-teslim dayanıklılığı, browser matrisi, FPS ve güvenlik/backup-restore tatbikatı `NOT VERIFIED`: Test matrisi bunları Faz 5/8/10 veya release'e atar. Faz 1'de bağımsız servis yeniden başlatma ve migration/ledger korumaları doğrulandı.
- Uzak GitHub branch-protection ve CI run'ı bu turda yeniden çağrılmadı `NOT VERIFIED`: P1.7 tamamlanma kanıtındaki `31744637453` run ve strict required-check kanıtı değişmeden duruyor; bu yerel faz regresyonunun yeniden doğruladığı kısım CI workflow sözleşmesidir.

## Kapı sonucu

`PASS`
