# NEXUS 2040: Ghost Grid - Proje Talimatları

## Kaynak ve kapsam

- `GAME_PLAN.md` geliştirme, kapsam, faz, görev, kabul ölçütü ve kararlar için tek operasyonel kaynaktır.
- Her görevden önce `GAME_PLAN.md` içindeki `Aktif çalışma`, ilgili faz, `Kalite kapısı protokolü`, `Definition of Done` ve ilgili kararları oku.
- DOCX dosyaları arşivlenmiş tasarım arka planıdır. Kullanıcı açıkça istemedikçe, planda çözülemeyen bir çelişki olmadıkça veya yeni GDD sürümü hazırlanmadıkça DOCX açma.
- Yalnız `ACTIVE` fazda uygulama yap. Faz `READY` ise kullanıcı/ana ajan aktivasyonu olmadan kodlama başlatma. `BLOCKED` fazdan görev alma.
- Faz dışı özellik ekleme. Gerekirse önce plan değişiklik protokolünü uygula.

## Çalışma düzeni

- Uygulama için `$execute-game-phase`, faz/görev kapatma için `$verify-game-phase` kullan.
- Ekonomi, ödül, formül, pazar veya NPC adaptasyonu değişirse `$balance-game-systems` kullan.
- Siber operasyon mekaniği veya anlatısı değişirse `$review-safe-cyber-content` kullan.
- Aynı dosyalara paralel ajan yazdırma. Normal düzen: salt-okunur keşif/inceleme ajanları paralel, tek uygulama yazarı seri.
- `phase_architect` bağımlılık ve sınırları; `gameplay_economy_reviewer` dengeyi; `quality_gate_reviewer` genel kapıyı; `security_safety_reviewer` güvenlik ve içerik sınırını; `lifecycle_game_tester` oyuncu yolculuğu ve yaşam döngüsü regresyonunu denetler.
- Ajan bulgusunu kanıtlamadan uygulama. Ana ajan bütün sonuçları birleştirir ve son kararı verir.
- `quality_gate_reviewer` testlerin geçici çıktı üretmesine izin veren `workspace-write` sandbox'ı kullanır; uygulama kaynağına ve `GAME_PLAN.md` dosyasına yazamaz.
- `lifecycle_game_tester` uygulama davranışı ekleyen her görevden sonra dar smoke testi, her faz kapanışında regresyon paketi, Faz 10 sonunda tam release kabulü ve sonraki sürümlerde uyumluluk testi çalıştırır.
- Yaşam döngüsü ajanı uygulama/plan kaynağı yazamaz; yalnız geçici test çıktısı ve `docs/test-reports/` altındaki raporu yazabilir. Faz, gerekli yaşam döngüsü raporu `PASS` olmadan kapanamaz.

## Uygulama ilkeleri

- Sunucu; bakiye, zaman, seed, hedef, başarı, tespit, ödül ve dünya etkisinin otoritesidir.
- Simülasyon kodunu yan etkisiz, deterministik ve sürümlü tut.
- PostgreSQL kalıcı sistem kaydıdır; Redis bakiye veya tamamlanma için tek doğruluk kaynağı olamaz.
- İstemciden gelen skor, süre, bakiye, seed ve sonuç değerlerine güvenme.
- Ledger değişikliklerini atomik, idempotent ve neden kodlu kaydet.
- İlgisiz dosyaları değiştirme; kullanıcı değişikliklerini koru.
- Yeni production bağımlılığı eklemeden önce gerekçeyi ve daha küçük alternatifi değerlendir.

## Doğrulama

- Değişiklik kapsamına uygun en dar testleri önce, `pnpm verify` kontrolünü görev kapanışında çalıştır.
- Komut henüz yoksa testi atlanmış sayma; ilgili plan görevinin tamamlanmadığını bildir.
- Formül değişikliğinde birim, property, monotonluk ve sabit-seed Monte Carlo kontrolleri zorunludur.
- Şema değişikliğinde migration, geri dönüş, idempotency ve eşzamanlılık kontrolleri zorunludur.
- UI değişikliğinde klavye, odak, renk bağımsız anlam ve reduced-motion etkisini kontrol et.
- Görev ancak testler geçince, ilgili inceleme tamamlanınca ve `GAME_PLAN.md` tamamlama kanıtı güncellenince biter.

## Siber güvenlik ve etik sınır

- Gerçek komut, payload, CVE uygulaması, parola kırma tarifi, gerçek kurum/IP/hedef veya çalışır kötüye kullanım adımı üretme.
- Gerçekçiliği belirsizlik, kaynak bütçesi, tespit, segmentasyon, containment, delil ve toparlanma kararlarıyla kur.
- Şüpheli içerikte `security_safety_reviewer` onayı olmadan görevi kapatma.
- Günlük seri, çevrimdışı yağma, loot box, ücretli güç ve zorunlu bekleme duvarı ekleme.

## Plan güncelleme kuralları

- Tamamlanmamış görevi `[x]` yapma.
- Test çıktısı veya dosya referansı olmadan tamamlama kanıtı yazma.
- Karar geçmişini silme; yeni karar kimliğiyle değişikliği kaydet.
- Bir fazı `COMPLETE` yapmadan bütün çıkış kapılarını `$verify-game-phase` ile doğrula.
- Faz geçişinde önce eski fazı kapat, sonra tek bir sonraki fazı `READY` yap. Kullanıcı yeni fazı başlatmayı istediğinde onu ayrıca `ACTIVE` yap.

## Code Review Rules

- Plan dışı kapsamı, istemci otoritesi sızıntısını, deterministik olmayan simülasyonu, ledger yarışlarını, eksik migration testini ve güvenli siber içerik ihlalini yüksek öncelikli bulgu say.
- Yalnız stil tercihine dayanan bulgu verme; doğruluk, güvenlik, veri kaybı, erişilebilirlik, performans veya bakım riski göster.
- Bulguları dosya/simge, yeniden üretim ve beklenen davranışla somutlaştır.
