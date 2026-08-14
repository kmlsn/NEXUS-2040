# Faz 1 Kapı Raporu - Teknik temel

> Tarih: 2026-08-14  
> Formül sürümü: `balance-1.2`  
> İçerik sürümü: `asteria-baseline-0.2`  
> Sonuç: **PASS**

## Kapsam

Bu kapı, Faz 1'in test edilebilir, sürümlenebilir ve sunucu otoriteli teknik temelini doğrular. Kapsama pnpm çalışma alanı, React üretim kabuğu, NestJS API/worker liveness yüzeyleri, PostgreSQL kalıcı kayıt ve Redis geçici katman sınırı, migration/ledger korumaları, deterministik çalışma zamanı portları, CI zorunlu kontrolleri ve yerel başlangıç rehberi girer. Oyun ekonomisi, oyuncu yolculukları, operasyon içeriği, tarayıcı erişilebilirliği ve performans bütçeleri sonraki fazların kapsamındadır.

## Çıkış koşulları

| Koşul | Kanıt | Sonuç |
|---|---|---|
| Web, API ve worker sağlık kontrolleri çalışır | `pnpm test` üretim Vite build'i, `scripts/web-smoke.mjs` loopback `GET /` kabuğunu; `scripts/http-smoke.mjs` API ve worker `GET /health` sözleşmelerini doğrular. | PASS |
| PostgreSQL sistem kaydı, Redis yalnız geçici katmandır | Migration'lar profile/version/ledger/idempotency verisini PostgreSQL'de saklar; lifecycle restart testi PostgreSQL profil satırını ve Redis'in yalnız sentetik geçici anahtarını yeniden okur. | PASS |
| CI zorunlu kontrolleri geçmeden değişiklik kabul etmez | `main` için GitHub required check'leri `lint`, `typecheck`, `unit`, `integration`; strict/up-to-date ve PR koruması P1.7'de doğrulandı. GitHub Actions run `31744637453` dört işi de başarıyla tamamladı. | PASS |
| Faz kanıt raporu bulunur | Bu rapor ve `docs/test-reports/P1-lifecycle.md` depoda sürümlüdür. | PASS |

## Komut kanıtı

| Komut | Sonuç |
|---|---|
| `py -3 .agents/skills/verify-game-phase/scripts/validate_plan.py GAME_PLAN.md` | PASS; 11 faz, 83 görev ve karar sözleşmesi tutarlı. |
| `pnpm install --frozen-lockfile` | PASS; kilitli çalışma alanı çözüldü. |
| `pnpm lint` ve `pnpm typecheck` | PASS. |
| `pnpm test` | PASS; contracts/simulation/PCG Python fixture, web üretim shell liveness, API/worker health, correlation ve public-error sözleşmeleri geçti. |
| `pnpm services:up -> pnpm test:integration -> pnpm services:down` | PASS; migration ileri/geri/tekrar, checksum, immutable ledger, rollback guard ve iki bağımsız PostgreSQL istemcisiyle eşzamanlı idempotency yarışında tek kayıt doğrulandı. |
| `pnpm services:up -> pnpm verify -> pnpm services:down` | PASS; servisler healthy iken tam kök kalite zinciri geçti ve konteyner/ağ temiz kapandı. |
| `pnpm test:e2e`, `pnpm balance:check` | Exit 0, açıkça Faz 1 kapsamında deferred. Oyuncu yolculuğu/ekonomi henüz uygulanmadığı için bunlar oyun E2E veya yeni denge kanıtı olarak sayılmadı. |

## Bağımsız incelemeler

- `security_safety_reviewer`: persistence, HTTP hata/log ve içerik sınırında D-006/D-011 ile uyumlu; ilk incelemenin web liveness ve rapor eksikleri bu kapıda giderildi.
- `quality_gate_reviewer`: web üretim liveness, eşzamanlı idempotency ve stabil tam `pnpm verify` sonrası P0/P1 bulgu olmadığını doğruladı.
- `lifecycle_game_tester`: `phase-regression` sonucu **PASS**; ayrıntılı kara-kutu kanıt `docs/test-reports/P1-lifecycle.md` içindedir.

## Kabul edilmiş sınırlar

- Tarayıcıda tam oyuncu akışı, erişilebilirlik denetimi, yük/FPS ölçümü, worker tekrar-teslim dayanıklılığı ve yedekleme/geri yükleme Faz 1 kapısı değildir; planın Faz 5, 7, 8 ve 10 kapılarına taşınmıştır.
- Redis bakiye, tamamlanma veya ledger için otorite değildir; bu fazda yalnız geçici altyapı ve yeniden başlatma sınırı doğrulanmıştır.

## Kapı kararı

Faz 1'in bütün görevleri, zorunlu kontrolleri ve çıkış koşulları kanıtlanmıştır. **Faz 1 COMPLETE**. Kullanıcının kesintisiz, sıralı geliştirme talimatına dayanarak **Faz 2 ACTIVE** yapılmıştır.
