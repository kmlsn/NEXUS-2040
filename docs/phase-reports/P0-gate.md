# Faz 0 Kapı Raporu - Plan ve Çalışma Sistemi

> Tarih: 2026-08-09  
> Plan sürümü: 1.3  
> Formül sürümü: `balance-1.2`  
> İçerik sürümü: `asteria-baseline-0.2`  
> Sonuç: **PASS**

## Kapsam

Bu kapı oyun kodunu başlatmadan operasyonel Markdown planını, proje talimatlarını, dört proje skill'ini, altı özel ajanı, yapısal doğrulayıcıyı, normatif matematiği, benchmark/hata sözleşmelerini, yaşam döngüsü test düzenini ve güvenli kurmaca içerik sınırlarını doğrular. Faz 1 bu raporla yalnız `READY` durumundadır; aktive edilmemiştir.

## Doğrulanan yapılar

- `GAME_PLAN.md`: 11 faz, 83 görev, 9 tamamlanmış görev, 16 karar, tek faz durum akışı, risk/kanıt kayıtları ve normatif matematik.
- `AGENTS.md`: Markdown kaynak-of-truth, tek yazar, faz sınırı, test ve güvenli içerik kuralları.
- `.agents/skills/`: uygulama, görev/faz doğrulama, denge ve güvenli siber içerik iş akışları.
- `.codex/agents/`: mimari, uygulama, ekonomi, kalite, güvenlik ve bağımsız yaşam döngüsü test rolleri.
- `docs/test-reports/TEST_REPORT_TEMPLATE.md`: görev smoke, faz regresyonu, release kabulü ve yayın sonrası uyumluluk için kanıt şablonu.
- `tools/balance_model.py`: sürümlü PCG32, ayrı domain stream'leri, half-away yuvarlama ve sistem denklemleri.
- `docs/balance_results_v1.1.json`: `balance-1.2` / `asteria-baseline-0.2` için üretilmiş sonuç ve audit kanıtı.

## Komut kanıtı

| Kontrol | Komut/araç | Sonuç |
|---|---|---|
| Plan yapısı ve artifact sözleşmesi | `python -B .agents/skills/verify-game-phase/scripts/validate_plan.py GAME_PLAN.md` | PASS; 11 faz, 83 görev, 9 tamamlanmış görev, 16 karar |
| Skill yapısı | `quick_validate.py` ile dört `.agents/skills/*` dizini | Dördü de `Skill is valid!` |
| Ajan yapılandırması | Python `tomllib` ile `.codex/config.toml` ve altı ajan TOML'u | Geçerli; ad, talimat ve sandbox alanları mevcut |
| Yaşam döngüsü regresyonu | `lifecycle_game_tester` / `docs/test-reports/P0-lifecycle.md` | PASS; ilk koşudaki `LC-P0-001` düzeltme sonrası yeniden üretilemedi ve kapatıldı |
| Denge ve determinizm | `python -B tools/balance_model.py` | PASS; 12 audit kontrolü |
| Eş-kademe başarı | 5 profil x `100000` örnek, seed `20260809` | `%64.47-%79.99`; hedef `%60-%85` |
| Aktif/seyrek oyuncu | 30 günlük normalize ledger, 2 ve 10 operasyon/gün | `%5.3`; hedef `<%20` |
| Pazar | Doğrudan `0.85-1.15` ayar eşitliği + zorlanmış uç şoklar | PASS |
| Node Routing | Nötr `50` karşılaştırıcısından en iyi/en kötü etki | Her yönde en fazla 10 yüzde puan; PASS |
| Tekrar üretilebilirlik | PCG32 golden vektörü + score/success/detection/reward stream izolasyonu | PASS |
| Güvenli içerik | Gerçek komut/CVE/hedef/ad taraması ve içerik manifesti sözleşmesi | PASS |

## Bağımsız ajan incelemeleri

### Skill ileri testi

İlk tur görev/faz kapısı ayrımı, `READY→ACTIVE` geçişi, görev doğrulaması ve P1.1 kabul ölçütlerinde altı açık buldu. Düzeltmelerden sonraki tekrar test sonucu **PASS**; P1.1'in kullanıcı Faz 1'i açıkça başlatmadan uygulanamayacağını doğruladı.

### Plan ve mimari tutarlılık

İlk turlar matematik kaynağı, benchmark, hata sınıfları, ajan yazma yetkisi, platformlar arası seed/yuvarlama ve RNG stream izolasyonu açıklarını buldu. Plan, doğrulayıcı ve yürütülebilir model güncellendi. Son tekrar test sonucu **PASS**.

### Denge ve güvenli içerik

İlk turlar tam-ledger metriği, doğrudan pazar sınırı, Node etki tavanı, NPC unutması, yükleme/Node/dünya uygulama testleri ve gerçek organizasyon adı çakışmasını buldu. Çakışan ad `Nexilune Industrial` olarak değiştirildi, içerik sürümü yükseltildi ve JSON yeniden üretildi. Son tekrar test sonucu **PASS**.

### Yaşam döngüsü testi

İlk `phase-regression` koşusu yeni ajan/rapor yapısını, 4/4 skill'i, 6/6 ajanı ve Faz 1'in başlamadığını doğruladı; bu kapı raporundaki eski plan 1.2 ve 82/8/15 sayılarını `LC-P0-001` olarak yakaladı. Rapor plan 1.3 ve 83/9/16 yapısına güncellendi. Tekrar koşusu **PASS** verdi; bulgu yeniden üretilemedi ve kapatıldı.

## Kalan, kabul edilmiş sınırlar

- 30 günlük ledger şu anda normalize araştırma karşılaştırıcısıdır. Faz 2 gerçek kaynak shadow-price tablosunu, Faz 4 gerçek operasyon akışını bağlayacak; Faz 9 aynı `<%20` kapısını gerçek ledger verisiyle tekrar çalıştıracaktır.
- Web tam-eşleşme taraması isim çakışması riskini azaltır fakat hukuki marka araştırması değildir. Ticari yayın öncesi resmi marka kontrolü gerekir.
- Proje-local skill/ajanların mevcut açık Codex oturumunda görünmesi istemci yenilemesi gerektirebilir; dosya sözleşmeleri doğrulanmıştır.
- Oyun kodu, veri tabanı veya servis iskeleti bu fazda başlatılmamıştır.

## Kapı kararı

Faz 0'ın bütün görevleri ve çıkış koşulları kanıtlanmıştır. **Faz 0 COMPLETE**, **Faz 1 READY** kalır. Faz 1 ancak kullanıcının açık başlatma talebiyle `ACTIVE` yapılabilir.
