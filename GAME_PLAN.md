# NEXUS 2040: Ghost Grid - Ana Geliştirme Planı

> Belge sürümü: 1.0  
> Son güncelleme: 9 Ağustos 2026  
> Durum: Planlama tamamlandı; Faz 1 başlamaya hazır  
> Operasyonel kaynak: Bu dosya

## 1. Kaynak-of-truth sözleşmesi

Bu dosya oyunun günlük geliştirme, kapsam, görev, test, faz kapısı ve karar kaydı için tek operasyonel kaynaktır. Bu planda adı ve sürümü sabitlenmiş kod/JSON çıktıları yürütülebilir kanıttır; bağımsız tasarım kaynağı değildir ve planla çelişirse plan geçerlidir.

- Her görev başlamadan önce yalnız bu dosyanın `Aktif çalışma`, ilgili faz, kalite kapıları ve karar kaydı bölümleri okunur.
- `docs/NEXUS_2040_Ghost_Grid_GDD_v1.1.docx` arşivlenmiş tasarım arka planıdır; rutin geliştirmede açılmaz.
- Word belgesine yalnız kullanıcı açıkça isterse, bu planda çözülemeyen bir tasarım çelişkisi varsa veya yeni ana GDD sürümü hazırlanacaksa dönülür.
- Kod, test ve bu plan çelişirse iş durdurulur. Önce karar kaydı güncellenir, ardından kod değiştirilir.
- Aynı anda yalnız bir geliştirme fazı `ACTIVE` olabilir.
- Bir fazın bütün çıkış koşulları kanıtlanmadan sonraki faz `ACTIVE` yapılamaz.
- Tamamlanan görevler kanıt bağlantısı veya doğrulama komutuyla birlikte `Tamamlama kanıtı` tablosuna işlenir.

### 1.1 Durum değerleri

| Durum | Anlamı |
|---|---|
| `COMPLETE` | Bütün faz kapıları kanıtlandı. |
| `ACTIVE` | Uygulama yapılabilen tek faz. |
| `READY` | Ön koşulları tamam; kullanıcı/ana ajan başlatabilir. |
| `BLOCKED` | Önceki faz tamamlanmadan başlanamaz. |
| `PAUSED` | Bilinçli olarak durduruldu; gerekçe kayıtta olmalı. |

## 2. Aktif çalışma

| Alan | Değer |
|---|---|
| Mevcut faz | Faz 3 - Yaşayan NPC dünyası (`ACTIVE`) |
| Sonraki faz | Faz 4 - Taktik operasyon simülasyonu (`BLOCKED`) |
| Sonraki görev | `P3.2` Üç NPC organizasyonunun amaç, kapasite, ilişki ve doktrin durumlarını oluştur |
| Kodlama durumu | P3.1 deterministik dünya temeli tamamlandı; NPC organizasyon durumu uygulanabilir |
| Son faz kapısı | Faz 2 ekonomi, kalite ve yaşam döngüsü kanıtları |
| Başlatma kuralı | Kullanıcının kesintisiz ve sıralı ilerleme yetkisiyle Faz 3 etkin; yalnız Faz 3 görevleri uygulanabilir. |

## 3. Ürün tanımı

### 3.1 Tek cümlelik ürün tezi

Oyuncu 2040 yılında bağımsız bir teknoloji ve siber güvenlik konsorsiyumunu yönetir; üretim, araştırma, NPC pazarı ve sözleşme kararlarını, güvenli biçimde soyutlanmış taktik PvE siber operasyonlarla sonuçlandırır.

### 3.2 Birinci ürün: tek oyunculu PvE

- Masaüstü öncelikli tarayıcı oyunu.
- Tek oyunculu fakat sunucu otoriteli kalıcı profil.
- Bir bölge: Asteria.
- Üç NPC organizasyonu: Nexilune Industrial, Asteria Civic Grid ve Free Mesh.
- Beş ana kaynak: Enerji, İşlem Gücü, Bileşen, Sermaye ve Uzmanlık.
- Beş tesis: Mikro Şebeke, Veri Merkezi, Robotik Atölye, Araştırma Laboratuvarı ve Güvenlik Operasyon Merkezi.
- Üç görev tipi, on iki hedef varyantı ve tek mini oyun: Node Routing.
- Yaşayan NPC pazarı, sözleşme panosu, NPC hafızası ve doktrin adaptasyonu.
- Kalıcı ana merkez güvenlidir; başarısızlık kalıcı tesis veya araştırma kaybettirmez.

### 3.3 Çekirdek döngü

1. Dünya olayını ve pazar sinyalini oku.
2. Enerji, üretim ve araştırma önceliklerini ayarla.
3. Sözleşme veya kriz hedefi seç.
4. İstihbarat topla ve kapasite sınırlı yükleme hazırla.
5. Taktik operasyonu ve Node Routing kararını oyna.
6. Çıkış, tespit, delil ve ısı sonucunu çöz.
7. Pazar, NPC ilişkisi, bölgesel güven ve etki değişimini uygula.
8. Kazancı tesise, araştırmaya veya sonraki sözleşmeye yatır.

### 3.4 Değişmez ürün ilkeleri

- Stratejik katman operasyona neden verir; operasyon stratejik dünyayı değiştirmelidir.
- Gerçekçilik gerçek saldırı komutu veya uygulanabilir kötüye kullanım tarifi içermez.
- Günlük seri, çevrimdışı yağma, loot box, ücretli güç ve zorunlu bekleme duvarı kullanılmaz.
- Başarısızlık açıklanabilir olmalı ve en az kısmi analiz/delil değeri üretmelidir.
- Uzun oynama ham ekonomik gücü sınırsız büyütmemelidir.
- RNG, hedef değerleri veya zorluk operasyon başladıktan sonra gizlice değişmemelidir.
- Önce tek oyunculu çekirdek kanıtlanır; çok oyunculu sistem ayrı giriş kapılarından geçer.

### 3.5 İlk sürüm dışında

- PvP, klanlar, oyuncu pazarı ve sezon sıfırlaması.
- Mobil istemci ve push bildirim altyapısı.
- Üç boyutlu dünya küresi.
- Node Routing dışında mini oyun.
- Kullanıcı üretimli görev, terminal veya komut paylaşımı.
- Gerçek para ekonomisi ve ödeme sistemi.
- Mikroservis ayrıştırması ve çok bölgeli dağıtım.

## 4. Teknik yön

### 4.1 Mimari karar

- Monorepo ve modüler monolit.
- Web: React + TypeScript.
- Dinamik harita/mini oyun: PixiJS; kritik metin ve formlar erişilebilir DOM'da.
- API ve worker: NestJS tabanlı ayrı süreçler.
- Kalıcı sistem kaydı: PostgreSQL.
- Geçici veri, oran sınırlama ve kuyruk: Redis/BullMQ; bakiye otoritesi değildir.
- Test: hızlı birim/property testleri, API entegrasyon testleri ve Playwright uçtan uca akışları.
- Paket yöneticisi: pnpm.
- Sunucu; bakiye, zaman, seed, hedef, başarı, tespit, ödül ve dünya etkisinin tek otoritesidir.
- Normatif başlangıç sürümleri `formula_version=balance-1.2` ve `content_version=asteria-baseline-0.2`'dir; her simülasyon bu sürümleri ve tekrar üretilebilir seed'i taşır.
- Normatif matematik bu planın 28. bölümündedir. `tools/balance_model.py` yürütülebilir referans, `docs/balance_results_v1.1.json` üretilmiş kanıttır; ikisi de sürüm alanı taşır.

### 4.2 Hedef depo yapısı

```text
apps/
  web/                 # React arayüzü ve PixiJS yüzeyleri
  api/                 # NestJS HTTP/WebSocket API
  worker/              # Dünya çevrimi, kuyruk ve uzlaşma işleri
packages/
  contracts/           # Paylaşılan şema ve olay sözleşmeleri
  simulation/          # Saf deterministik oyun matematiği
  content/             # Sürümlü görev, hedef ve kampanya verisi
  ui/                  # Tasarım sistemi ve erişilebilir bileşenler
infra/                 # Yerel geliştirme ve dağıtım tanımları
tests/                 # Entegrasyon, E2E, denge ve yük senaryoları
docs/phase-reports/    # Faz kapısı kanıtları; gerektiğinde oluşturulur
```

### 4.3 Hedef komut sözleşmesi

Faz 1 bu komutları gerçek ve tek giriş noktası yapacaktır:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm balance:check
pnpm plan:check
pnpm verify
```

`pnpm verify`, o ana kadar mevcut bütün zorunlu kontrolleri çalıştırmalıdır. Bir komut henüz oluşturulmadıysa ajan bunu sessizce atlamaz; ilgili görev tamamlanmamış sayılır.

## 5. Faz özeti

| Faz | Ad | Durum | 3 kişilik hedef süre | Ana çıkış |
|---:|---|---|---:|---|
| 0 | Plan ve çalışma sistemi | `COMPLETE` | 3 hafta araştırma dahil | Plan, beceriler ve ajanlar doğrulandı |
| 1 | Teknik temel | `COMPLETE` | 4 hafta | Uygulamalar, veri tabanı, CI ve komut sözleşmesi çalışıyor |
| 2 | Stratejik ekonomi | `COMPLETE` | 5 hafta | Beş kaynak ve tesis döngüsü uçtan uca çalışıyor |
| 3 | Yaşayan NPC dünyası | `ACTIVE` | 3 hafta | Dünya çevrimi, pazar ve sözleşmeler deterministik |
| 4 | Taktik operasyon simülasyonu | `BLOCKED` | 4 hafta | Keşif-yükleme-sonuç-rapor döngüsü oynanabilir |
| 5 | Node Routing | `BLOCKED` | 2 hafta | Mini oyun erişilebilir ve sunucu doğrulamalı |
| 6 | Asteria birleşik dikey kesiti | `BLOCKED` | 4 hafta | Strateji ve operasyon karşılıklı sonuç üretiyor |
| 7 | Deneyim ve erişilebilirlik cilası | `BLOCKED` | 2 hafta | Kritik akışlar WCAG 2.2 AA hedefini karşılıyor |
| 8 | Güvenlik, performans ve telemetri | `BLOCKED` | 3 hafta | Ürün alfa için ölçülebilir ve dayanıklı |
| 9 | Kapalı alfa ve denge | `BLOCKED` | 3 hafta | Ürün metrikleri go/no-go hedeflerini karşılıyor |
| 10 | Tek oyunculu 1.0 adayı | `BLOCKED` | 2 hafta | Yayın, geri dönüş ve veri göçü hazır |

Tek geliştirici + AI için toplam tam zamanlı tahmin 48-64 haftadır. Süreler kalite kapılarından feragat edilerek kısaltılmaz; kapsam kesilir.

## 6. Faz 0 - Plan ve çalışma sistemi

**Amaç:** Kod başlamadan kapsamı, ilerleme kaydını, becerileri, ajan sorumluluklarını ve faz geçiş kurallarını sabitlemek.

### Görevler

- [x] **P0.1** Bu Markdown planını operasyonel kaynak olarak oluştur.
- [x] **P0.2** Word belgesinin yalnız arşiv/arka plan olduğunu kalıcı proje talimatına yaz.
- [x] **P0.3** Faz tablosu, karar kaydı, risk kaydı ve kabul metriklerini tanımla.
- [x] **P0.4** Projeye özel uygulama, doğrulama, denge ve güvenli içerik becerilerini oluştur.
- [x] **P0.5** Projeye özel mimari, uygulama, denge, kalite ve güvenlik ajanlarını oluştur.
- [x] **P0.6** Plan doğrulama betiğini çalıştır ve bağımsız ajan incelemesi yap.
- [x] **P0.7** Normatif matematik, sürüm, denge karşılaştırıcıları ve güvenli içerik kanıt formatını bu plana sabitle.
- [x] **P0.8** Benchmark sözleşmesi ile P0-P3 hata şiddeti ve risk kabul kurallarını tanımla.
- [x] **P0.9** Her görev/faz ve tamamlanmış oyun sürümü için bağımsız yaşam döngüsü test ajanını ve rapor sözleşmesini tanımla.

### Faz 0 çıkış kapısı

- `GAME_PLAN.md` tutarlılık kontrolü geçer.
- `AGENTS.md`, `.codex/agents/` ve `.agents/skills/` keşfedilebilir konumdadır.
- Bütün beceriler `quick_validate.py` kontrolünü geçer.
- En az iki salt-okunur ajan planı birbirinden bağımsız inceler.
- Matematik referansı aynı seed ve sürümle tekrar üretilebilir; doğrudan sınır kontrolleri geçer.
- Benchmark ve hata şiddeti kapıları ölçülebilir biçimde tanımlıdır.
- Yaşam döngüsü test ajanı, rapor şablonu ve faz/release tetikleyicileri doğrulanmıştır.
- Açık kritik plan çelişkisi kalmaz.

## 7. Faz 1 - Teknik temel

**Amaç:** Oyun sistemleri eklenmeden test edilebilir, sürümlenebilir ve sunucu otoriteli iskeleti kurmak.

### Görevler

- [x] **P1.1** pnpm monorepo, TypeScript ortak ayarları ve hedef komut sözleşmesini kur.
  - Kabul: temiz kurulumdan sonra kök workspace `apps/*` ve `packages/*` desenlerini tanır; kökte `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `balance:check`, `plan:check` ve `verify` komut adları bulunur; bu görev uygulama özelliği eklemez; `plan:check` geçer ve diğer komutlar henüz boş kapsamdaysa açıkça başarılı no-op olarak raporlanır.
- [x] **P1.2** `apps/web`, `apps/api`, `apps/worker` ve paylaşılmış paketleri oluştur.
- [x] **P1.3** Yerel PostgreSQL/Redis geliştirme ortamını ve örnek çevre değişkenlerini kur; gerçek sır saklama.
- [x] **P1.4** Profil, kaynak ledger'ı, içerik sürümü ve idempotency için ilk migration'ları yaz.
- [x] **P1.5** Saat, UUID ve Bölüm 28 PCG32 seed/stream sözleşmesi için testte değiştirilebilir soyutlamalar oluştur; Python/TypeScript golden vektörünü birebir geçir.
- [x] **P1.6** Sağlık kontrolü, yapılandırılmış log, hata sözleşmesi ve request correlation ekle.
- [x] **P1.7** CI üzerinde lint, typecheck, unit ve entegrasyon testlerini zorunlu yap.
- [x] **P1.8** Yerel geliştirme başlangıç rehberini kısa ve komut odaklı olarak bu plandaki komutlarla eşleştir.

### Zorunlu kontroller

- Temiz kurulumdan sonra tek komutla bağımlılıklar ve yerel servisler hazırlanabilir.
- Aynı idempotency anahtarı iki ledger hareketi oluşturamaz.
- Migration ileri/geri testi veri kaybetmeden çalışır.
- Seed ve sahte saat testleri aynı sonucu tekrar üretir.
- PCG32 golden vektörü ve ortak olasılık fixture'ları Python/TypeScript arasında birebir eşleşir.
- `pnpm verify` yeşildir.

### Faz 1 çıkış kapısı

- Web, API ve worker sağlık kontrolleri çalışır.
- PostgreSQL sistem kaydı, Redis yalnız geçici katmandır.
- CI zorunlu kontrolleri geçmeden değişiklik kabul etmez.
- `docs/phase-reports/P1-gate.md` kanıt raporu oluşturulur.

## 8. Faz 2 - Stratejik ekonomi

**Amaç:** Oyuncunun merkezini büyüttüğü, enerji kıtlığı ve yatırım seçimi üreten fakat giriş baskısı oluşturmayan ekonomik çekirdeği kurmak.

### Görevler

- [x] **P2.1** Enerji, İşlem Gücü, Bileşen, Sermaye ve Uzmanlık ledger işlemlerini uygula.
- [x] **P2.2** Beş tesis türünü ve seviye 1-12 veri şemasını oluştur.
- [x] **P2.3** Enerji önceliği ve kısmi verim çözümleyicisini saf fonksiyon olarak yaz.
- [x] **P2.4** 24-36 saatlik lazy accrual ve depolama kapasitesini uygula.
- [x] **P2.5** Ücretsiz tesis inşa kuyruğu, bitiş uzlaşması ve iptal iadesini uygula.
- [x] **P2.6** Merkez ekranında kaynak nedeni, üretim tahmini ve enerji yetersizliği açıklamasını göster.
- [x] **P2.7** Tesis eğrilerini ve 30 günlük tam-ledger aktif/seyrek oyuncu karşılaştırmasını `balance-1.3` ekonomi sözleşmesine göre doğrula.
- [x] **P2.8** Negatif bakiye, eşzamanlı harcama, taşma ve saat geri gitmesi property testlerini ekle.

### Değişmezler

- Tesis çıktısı seviye ile monoton artar.
- Yükseltme süreleri altı saat tavanını aşmaz.
- Başlangıç çevrimdışı kapasitesi en az 24 saattir.
- İptal iadesi ve tamamlanma aynı işi iki kez ödemez.
- İstemci kendi bakiyesini veya finish time değerini belirleyemez.

### Faz 2 çıkış kapısı

- Oyuncu enerji dağıtır, üretim biriktirir ve bir tesis yükseltmesini tamamlar.
- Yedi ve otuz günlük ekonomi simülasyonlarında negatif/taşan değer yoktur.
- Ekonomi ajanı formülleri ve kodu planla karşılaştırıp onaylar.
- `docs/phase-reports/P2-gate.md` oluşturulur.

## 9. Faz 3 - Yaşayan NPC dünyası

**Amaç:** Oyuncunun dışında hareket eden fakat ilerlemeyi rastgele kilitlemeyen Asteria dünya simülasyonunu kurmak.

### Görevler

- [x] **P3.1** Sürümlü `world_state` ve altı saatlik deterministik dünya çevrimini uygula.
- [x] **P3.2** Üç NPC organizasyonunun amaç, kapasite, ilişki ve doktrin durumlarını oluştur.
- [ ] **P3.3** Ortalama dönüşlü 0.85-1.15 NPC pazar endeksini ve hikâye şoklarını uygula; yapılandırma eşitliğini ve iki sınırı zorlayan property testleri ekle.
- [ ] **P3.4** Hikâye sözleşmesi ile teklif yarışlı pazar sözleşmesini ayır.
- [ ] **P3.5** Sözleşme teklif puanı, sınırlı teminat ve kayıp analiz ödülünü uygula.
- [ ] **P3.6** En az yedi günlük sözleşme arşivini ve kaçırmama davranışını ekle.
- [ ] **P3.7** Dünya, pazar, sözleşme ve NPC kararlarının olay günlüğünü oluştur.
- [ ] **P3.8** Aynı seed/sürüm için 120 günlük tekrar üretilebilir stres testi yaz.

### Değişmezler

- Ana hikâye ilerlemesi teklif RNG'siyle kilitlenmez.
- Pazar endeksi belirlenen koridoru aşmaz.
- Kalıcı merkez dünya olayıyla zarar görmez.
- NPC kararı, kullanılan girdiler ve formül sürümüyle açıklanabilir.

### Faz 3 çıkış kapısı

- Oyuncu bir kriz görür, üretimini yeniden dağıtır, sözleşme seçer ve NPC tepkisini izler.
- 120 günlük simülasyon aynı seed ile aynı sonuç özetini üretir.
- `docs/phase-reports/P3-gate.md` oluşturulur.

## 10. Faz 4 - Taktik operasyon simülasyonu

**Amaç:** Mini oyun olmadan da tamamlanabilen, kararları ve sonuçları açıklanabilir PvE operasyon döngüsünü kurmak.

### Görevler

- [ ] **P4.1** Oyuncu statları, sürümlü araştırma projeleri, hedef savunmaları, görev ağırlıkları ve diminishing return fonksiyonunu uygula.
- [ ] **P4.2** Kademe 1-5 hedef üretimi; seed, arketip ve sabitlenmiş statları uygula.
- [ ] **P4.3** İstihbarat harcama, belirsizlik bandı ve keşif önizlemesini uygula.
- [ ] **P4.4** Bant kapasitesi sınırlı sessiz, dengeli ve hızlı yüklemeleri uygula.
- [ ] **P4.5** `balance-1.2` başarı, tespit, ısı, ödül ve başarısız delil çözümleyicisini saf paket içinde yaz.
- [ ] **P4.6** Operasyon durum makinesi ve sıralı olay günlüğünü uygula.
- [ ] **P4.7** Geri çekilme iadelerini ve başarısızlıkta taban delilin `%25` analiz değerini uygula; tespit edilmiş başarısızlıkta bunun üzerine `0.80` çarpanını uygula.
- [ ] **P4.8** Adli raporda her çarpanı ve değişimin nedenini göster.
- [ ] **P4.9** Eş-kademe ve çapraz-kademe Monte Carlo testlerini CI'a ekle.

### Denge hedefleri

- Eş-kademe başarı oranı: `%60-%85`.
- Bir üst kademeye erken giriş: riskli fakat mümkün.
- Isı arttıkça tespit olasılığı monoton artar.
- Başarı ve tespit ayrı rastgele çekilişlerdir; aynı skor ve durumdan türeyen olasılıklara koşullu olarak bağımsızdır.
- Hedef değerleri operasyon başlangıcından sonra değişmez.

### Faz 4 çıkış kapısı

- Brifing -> keşif -> yükleme -> karar -> çıkış -> rapor akışı uçtan uca çalışır.
- Aynı operasyon seed'i aynı temel sonucu tekrar üretir.
- Denge ajanı ve kalite ajanı bağımsız onay verir.
- `docs/phase-reports/P4-gate.md` oluşturulur.

## 11. Faz 5 - Node Routing

**Amaç:** Stratejik hazırlığı geçersiz kılmadan ustalık ve gerilim ekleyen erişilebilir tek mini oyunu üretmek.

### Görevler

- [ ] **P5.1** Her seed için en az bir geçerli yol üreten graf oluşturucuyu yaz.
- [ ] **P5.2** Risk, gecikme ve paket oranı skorunu uygula; nötr `50` skordan `100` skora başarı katkısını en fazla `+10` yüzde puan, `0` skordan nötre kaybı en fazla `-10` puan olarak sınırla.
- [ ] **P5.3** Fare, klavye ve tek tuş geri alma kontrollerini ekle.
- [ ] **P5.4** Süre kapalı alıştırma, 40 saniyelik erişilebilir mod ve nötr skorla atlama ekle.
- [ ] **P5.5** Renk + ikon + metin, görünür odak ve reduced-motion seçeneklerini uygula.
- [ ] **P5.6** İstemci yolunu ve skorunu sunucuda kurallara göre doğrula.
- [ ] **P5.7** Orta sınıf hedef cihazda 60 FPS profili ve graf property testleri çalıştır.

### Faz 5 çıkış kapısı

- Stratejik olarak eşit iki hazırlık arasında mini oyun farkı 10 yüzde puanı aşmaz.
- Atlama ödül cezası oluşturmaz ve nötr skor uygular.
- Yalnız klavye ile tamamlanabilir.
- `docs/phase-reports/P5-gate.md` oluşturulur.

## 12. Faz 6 - Asteria birleşik dikey kesiti

**Amaç:** Stratejik ve taktik katmanın tek oyun gibi hissettirdiği ilk tamamlanabilir kampanyayı üretmek.

### Görevler

- [ ] **P6.1** Asteria Enerji Krizi'nin altı ana sözleşme ve üç dünya olayını içerik şemasına yaz.
- [ ] **P6.2** Üç görev türünü ve on iki hedef varyantını tamamla.
- [ ] **P6.3** Operasyon sonucunun pazar, ilişki, istikrar ve etki değişimini uygula.
- [ ] **P6.4** Her 6 saatlik dünya çevriminde `exposure_next=round4(max(0,0.75*exposure_prev+max(0,new_exposure)))` maruziyetini ve `+10` adaptasyon tavanını uygula.
- [ ] **P6.5** Dört doktrin ve dört zafer ekseninin ilk sürümünü ekle.
- [ ] **P6.6** Düşük riskli ustalaşılmış sözleşmeler için `%78-%88` planlı çözümü ekle.
- [ ] **P6.7** İlk 30 dakikalık öğreticiyi gerçek oyun sistemleriyle tamamla.
- [ ] **P6.8** Save migration ve içerik sürümü uyumluluk testlerini yaz.

### Faz 6 çıkış kapısı

- Operasyon sonucu en az bir stratejik değişkeni görünür biçimde değiştirir.
- Oyuncu en az iki farklı doktrinle kampanya hedefinde ilerleyebilir.
- Otomatik çözüm manuel oyunu ekonomik olarak geçmez.
- On iki hedef güvenli içerik incelemesinden geçer.
- `docs/phase-reports/P6-gate.md` oluşturulur.

## 13. Faz 7 - Deneyim ve erişilebilirlik cilası

**Amaç:** Bilgi yoğun simülasyonu okunabilir, klavye erişimli ve yorucu olmayan bir komuta deneyimine dönüştürmek.

### Görevler

- [ ] **P7.1** Dünya, Merkez, Sözleşme, Operasyon ve Araştırma bilgi mimarisini sonlandır.
- [ ] **P7.2** Tasarım tokenları, durum ikonları ve renk bağımsız anlam sistemini uygula.
- [ ] **P7.3** Kritik akışların klavye, odak sırası ve ekran okuyucu etiketlerini tamamla.
- [ ] **P7.4** Reduced motion, efekt yoğunluğu, SFX ve otomatik log seçeneklerini ekle.
- [ ] **P7.5** Türkçe metin kalitesi, terim sözlüğü ve ileride yerelleştirme yapısını doğrula.
- [ ] **P7.6** Operasyon ve ekonomi açıklamalarını ilk kullanıcı testine göre sadeleştir.

### Faz 7 çıkış kapısı

- Kritik akışlar WCAG 2.2 AA hedefiyle denetlenir.
- Renk tek bilgi kanalı değildir.
- Temel görev yalnız klavye ile tamamlanır.
- `docs/phase-reports/P7-gate.md` oluşturulur.

## 14. Faz 8 - Güvenlik, performans ve telemetri

**Amaç:** Kapalı alfa öncesi ürünü güvenli, gözlemlenebilir, veri kaybına dayanıklı ve ölçülebilir yapmak.

### Görevler

- [ ] **P8.1** OWASP ASVS L2 odaklı kapsam matrisi ve tehdit modeli oluştur.
- [ ] **P8.2** Mesaj şeması, yetki, Origin, rate limit, boyut, nonce ve idempotency kontrollerini uygula.
- [ ] **P8.3** Ledger, worker uzlaşması, Redis kesintisi ve eşzamanlı işlem stres testlerini çalıştır.
- [ ] **P8.4** Yedek, geri yükleme, save migration ve içerik rollback tatbikatı yap.
- [ ] **P8.5** Ürün olaylarını şema sürümü ve minimum kişisel veriyle topla.
- [ ] **P8.6** API p95, olay gecikmesi, frontend FPS ve bellek bütçelerini ölç.
- [ ] **P8.7** Gerçek saldırı bilgisi, komut, CVE ve hedef sızıntısı için içerik denetimi çalıştır.
- [ ] **P8.8** Her operasyon içerik dosyasının yolu, içerik sürümü, SHA-256 özeti, inceleyen ajanı, sonucu ve bulgularını içeren güvenli içerik manifestini üret.

### Performans hedefleri

- API p95 `<250 ms` (uzun worker işleri hariç).
- Durum olayı p95 `<500 ms`.
- 1440x900 hedef cihazda Node Routing hedef `60 FPS`.
- Kritik/yüksek güvenlik bulgusu: `0`.

### Faz 8 çıkış kapısı

- Güvenlik, yük, kesinti ve geri yükleme raporları kanıtlıdır.
- Operasyon içeriğinin tamamı manifestte kayıtlıdır ve güvenlik incelemesinden `PASS` almıştır.
- Telemetri kullanıcı onayı ve veri minimizasyonuyla çalışır.
- `docs/phase-reports/P8-gate.md` oluşturulur.

## 15. Faz 9 - Kapalı alfa ve denge

**Amaç:** Özellik sayısını artırmadan 50-100 oyuncuyla çekirdek ürün tezini ölçmek.

### Görevler

- [ ] **P9.1** Alfa kohortu, onam, test senaryosu ve destek kanalını hazırla.
- [ ] **P9.2** Öğretici, ekonomi, operasyon ve dünya etkisi panolarını oluştur.
- [ ] **P9.3** Yükleme/doktrin seçim dağılımını ve dominant stratejileri incele.
- [ ] **P9.4** Başarı tahmini ile gerçek sonuç kalibrasyonunu ölç.
- [ ] **P9.5** Yalnız bir değişkeni bir sürümde değiştirerek denge iterasyonları yap.
- [ ] **P9.6** P0/P1 hataları kapat; P2 hataları risk kabulüyle kaydet.

### Go/no-go ürün hedefleri

| Ölçüm | Hedef |
|---|---:|
| İlk görev başlatma | `>=%80` |
| İlk görev tamamlama | `>=%70` |
| İkinci görevi gönüllü başlatma | `>=%60` |
| Sonucu doğru açıklama | `>=%80` |
| Strateji-operasyon bağını açıklama | `>=%75` |
| Algılanan adalet | `>=4/5` |
| Sağlıklı medyan oturum | `20-35 dakika` |
| Günde 2 ve 10 operasyon ekonomik farkı | `<%20` |

### Faz 9 çıkış kapısı

- Hedefler iki ardışık alfa yapısında karşılanır veya kapsamlı düzeltme kararı kayda alınır.
- İkinci görev ve adalet hedefleri geçmeden içerik hacmi artırılmaz.
- `docs/phase-reports/P9-gate.md` oluşturulur.

## 16. Faz 10 - Tek oyunculu 1.0 adayı

**Amaç:** Ölçülmüş PvE çekirdeğini güvenli yayın, geri dönüş ve destek düzeniyle ürünleştirmek.

### Görevler

- [ ] **P10.1** Yayın yapılandırması, sır yönetimi ve production migration planını tamamla.
- [ ] **P10.2** Save uyumluluğu, yedek ve rollback tatbikatını son kez çalıştır.
- [ ] **P10.3** Destek, gizlilik, kullanım şartları ve içerik güvenliği metinlerini hazırla.
- [ ] **P10.4** Kritik tarayıcılar ve hedef çözünürlüklerde smoke/E2E testlerini çalıştır.
- [ ] **P10.5** Sürüm notu, bilinen sorunlar ve izleme panolarını hazırla.
- [ ] **P10.6** Son yayın go/no-go toplantısı ve kanıt raporunu tamamla.

### Faz 10 çıkış kapısı

- P0/P1 hata yoktur.
- Geri yükleme ve rollback kanıtlanmıştır.
- Kritik kullanıcı akışları üretim benzeri ortamda geçer.
- `lifecycle_game_tester` tam `release-acceptance` paketini çalıştırır ve `docs/test-reports/P10-lifecycle.md` sonucu `PASS` olur.
- `docs/phase-reports/P10-gate.md` oluşturulur.

## 17. Çok oyunculuya geçiş programı

Çok oyunculu çalışma Faz 10 tamamlanınca otomatik başlamaz. Aşağıdaki giriş kapılarının tamamı gerekir:

- Tek oyunculu go/no-go hedefleri iki ardışık sürümde geçmiştir.
- Ekonomi 30 günlük üretim verisinde kontrol dışı enflasyon veya dominant doktrin üretmemiştir.
- Sunucu otoritesi, ledger, idempotency, tekrar oynatma ve audit log üretimde kanıtlanmıştır.
- Kalıcı ana merkezin güvenli kalacağı ve kaybın sınırlı olacağı tasarım değişmez olarak onaylanmıştır.
- Eşleştirme, moderasyon, engelleme, raporlama ve kötüye kullanım bütçesi ayrılmıştır.
- Oyuncu verisi ve topluluk özellikleri için ek gizlilik/güvenlik incelemesi tamamlanmıştır.

### MP-1 Asenkron sosyal katman

- Profil, arkadaşlar ve isteğe bağlı ustalık sıralamaları.
- Başka oyuncunun savunma kopyasına karşı kayıpsız tatbikat.
- Savunmacı kaynak kaybetmez; tekrar ve analiz ödülü görür.

### MP-2 Ortak PvE

- Küçük ekiplerle ortak kriz hedefleri.
- Katkı puanı toplam oynama süresine değil anlamlı role göre ölçülür.
- Çevrimdışı nöbet veya belirli saatte savunma zorunluluğu yoktur.

### MP-3 İsteğe bağlı dereceli rekabet

- İki tarafın kabul ettiği 100 kapasite puanlı yüklemeler.
- TrueSkill benzeri beceri + belirsizlik tabanlı eşleştirme araştırması.
- Kayıp bir normal oturumda telafi edilebilecek sınırlı teminattır.
- Aynı rakibi tekrar hedeflemenin getirisi hızla sıfıra iner.

### MP-4 İttifak ve kontrollü oyuncu ekonomisi

- 6-8 kişilik operasyon ekipleri.
- Çoklu onaylı ittifak kasası ve değişmez işlem günlüğü.
- NPC taban fiyat koridoru; manipülasyon ve tekelleşme stres testleri.
- Kalıcı tesis veya ana merkez kaybı yine yoktur.

## 18. Kalite kapısı protokolü

Her görev ve faz aşağıdaki sırayla kapatılır:

1. **Hazırlık:** `phase_architect` ilgili plan maddesini, bağımlılıkları ve kabul ölçütünü okur.
2. **Uygulama:** Yalnız `implementation_worker` veya ana ajan dosya yazar; paralel iki yazar kullanılmaz.
3. **Alan incelemesi:** Ekonomi/formül değişiminde `gameplay_economy_reviewer`; siber içerik/güvenlikte `security_safety_reviewer` çalışır.
4. **Genel doğrulama:** `quality_gate_reviewer` test, regresyon, erişilebilirlik ve plan sapmasını kontrol eder.
5. **Yaşam döngüsü testi:** `lifecycle_game_tester` davranış ekleyen görevde `task-smoke`, her faz kapanışında `phase-regression`, Faz 10 ve her release candidate'da `release-acceptance`, yayın sonrası yamada `post-release-compatibility` çalıştırır.
6. **Kanıt:** Komutlar, test sonuçları ve önemli dosyalar faz ve yaşam döngüsü raporuna yazılır.
7. **Plan güncellemesi:** Görev `[x]` yapılır, tamamlama kanıtı eklenir ve ancak kapı geçtiyse sonraki görev/faz açılır.

Bir inceleme ajanı bulgu verirse ana ajan kanıtı doğrular. Salt stil tercihi fazı engellemez; doğruluk, güvenlik, veri kaybı, erişilebilirlik, plan sapması ve eksik test engeller.

## 19. Test matrisi

| Katman | Zorunlu kontrol | Ne zaman |
|---|---|---|
| Saf matematik | Birim + property + monotonluk | Her formül değişikliği |
| Denge | Sabit seed Monte Carlo ve profil matrisi | Ekonomi/operasyon değişikliği |
| Veri | Migration, transaction, idempotency, concurrency | Şema/ledger değişikliği |
| API | Sözleşme ve entegrasyon testleri | Endpoint/olay değişikliği |
| Worker | Kesinti, tekrar çalışma ve uzlaşma | Kuyruk/dünya çevrimi değişikliği |
| UI | Bileşen, klavye ve durum testi | Görünür davranış değişikliği |
| E2E | Ana kullanıcı yolculukları | Faz kapısı ve release |
| Erişilebilirlik | Otomatik tarama + manuel klavye | UI fazı ve release |
| Performans | API p95, FPS, bellek ve yük | Faz 5, 8, 10 |
| Güvenlik | SAST, bağımlılık, şema/yetki ve tehdit modeli | Faz 8 ve release |
| İçerik güvenliği | Gerçek komut/CVE/hedef sızıntısı incelemesi | Her operasyon içerik paketi |
| Yaşam döngüsü kara-kutu | Task smoke, faz regresyonu, release kabulü ve yayın sonrası save/rollback uyumluluğu | Davranış görevi, her faz kapısı, Faz 10 ve her yayın |
| Plan tutarlılığı | `validate_plan.py` | Her plan güncellemesi |

## 20. Definition of Ready

Bir görev başlamadan önce:

- Görev kimliği ve bağlı olduğu faz bellidir.
- Kabul ölçütü test edilebilir biçimde yazılmıştır.
- Bağımlılıkları tamamlanmıştır.
- Etkilenecek modüller ve tek dosya-yazarı bellidir.
- Güvenlik, veri göçü veya kullanıcı kararı gerekip gerekmediği belirtilmiştir.
- Gerekli ajan/skill seçilmiştir.

## 21. Definition of Done

Bir görev ancak aşağıdakilerin tamamıyla `[x]` yapılır:

- İstenen davranış uygulanmıştır; placeholder değildir.
- İlgili otomatik testler eklenmiş ve geçmiştir.
- `pnpm verify` veya faza uygun alt kümesi geçmiştir.
- Plan, API sözleşmesi ve veri modeli birbiriyle tutarlıdır.
- Gerekli alan incelemesi tamamlanmıştır.
- Kullanıcıya görünür davranış değiştiyse erişilebilirlik ve açıklama metni kontrol edilmiştir.
- Görev için tamamlama kanıtı eklenmiştir.
- Uygulanabilir olduğunda yaşam döngüsü `task-smoke` raporu `PASS` olmuştur.
- Yeni kapsam gizlice eklenmemiştir.

## 22. Proje ajanları

| Ajan | Yazma | Kullanım |
|---|---|---|
| `phase_architect` | Hayır | Faz öncesi bağımlılık, mimari sınır ve plan tutarlılığı |
| `implementation_worker` | Evet | Tek, sınırları belirli görev uygulaması |
| `gameplay_economy_reviewer` | Hayır | Formül, ekonomi, ödül, NPC adaptasyonu ve simülasyon denetimi |
| `quality_gate_reviewer` | Yalnız geçici doğrulama çıktısı | Test, regresyon, performans, erişilebilirlik ve faz kapısı; uygulama/plan kaynağı yazmaz |
| `security_safety_reviewer` | Hayır | Uygulama güvenliği ve siber içerik güvenliği |
| `lifecycle_game_tester` | Yalnız test çıktısı/raporu | Görev smoke, her faz regresyonu, final release kabulü ve yayın sonrası uyumluluk; uygulama/plan kaynağı yazmaz |

## 23. Proje becerileri

| Beceri | Tetikleyici | Çıktı |
|---|---|---|
| `$execute-game-phase` | Aktif fazdan görev uygulama | Sınırlandırılmış değişiklik, test ve plan kanıtı |
| `$verify-game-phase` | Görev/faz kapatma | Plan, test ve kanıt tutarlılık raporu |
| `$balance-game-systems` | Formül, ekonomi, ödül veya NPC değişikliği | Simülasyon, invariant ve denge sonucu |
| `$review-safe-cyber-content` | Operasyon mekaniği veya siber anlatı değişikliği | Güvenli gerçekçilik incelemesi |

## 24. Karar kaydı

| Kimlik | Karar | Durum | Değiştirme koşulu |
|---|---|---|---|
| D-001 | İlk ürün tek oyunculu PvE'dir. | Kabul | Faz 9 ürün hedefleri geçmeden değişmez. |
| D-002 | `GAME_PLAN.md` operasyonel kaynaktır; GDD rutin okunmaz. | Kabul | Kullanıcı açıkça değiştirirse. |
| D-003 | Ana ekonomi beş kaynaktır. | Kabul | İlk kullanılabilirlik testi rol karışıklığı gösterirse azaltılır. |
| D-004 | Kalıcı ana merkez saldırıya ve kalıcı kayba kapalıdır. | Değişmez | Değiştirilmez. |
| D-005 | MVP modüler monolittir. | Kabul | Ölçülmüş ölçek veya ekip sahipliği ihtiyacı oluşursa. |
| D-006 | Sunucu bütün sonuçların otoritesidir. | Değişmez | Değiştirilmez. |
| D-007 | Simülasyon seed ve sürümle tekrar üretilebilir. | Değişmez | Değiştirilmez. |
| D-008 | Günlük seri, çevrimdışı yağma, loot box ve ücretli güç yoktur. | Değişmez | Değiştirilmez. |
| D-009 | Mini oyun MVP'de yalnız Node Routing'dir. | Kabul | Faz 9 tekrar yorgunluğu kanıtlanırsa. |
| D-010 | Çok oyunculu, tek oyunculu go/no-go sonrası ayrı programdır. | Kabul | Faz 10 ve MP giriş kapıları tamamlanırsa. |
| D-011 | Gerçek siber komut, CVE, gerçek hedef veya kötüye kullanım tarifi üretilmez. | Değişmez | Değiştirilmez. |
| D-012 | Aynı anda yalnız bir yazan ajan kullanılır. | Kabul | Dosya sahipliği kesin ayrılmış bağımsız işler varsa ana ajan onayıyla. |
| D-013 | Normatif başlangıç matematiği `balance-1.2`, içerik sürümü `asteria-baseline-0.2`'dir. | Kabul | Formül sürümü, karar kaydı, model ve test kanıtı birlikte güncellenirse. |
| D-014 | Faz kapanışı sonraki fazı yalnız `READY` yapar; `ACTIVE` geçişi açık kullanıcı talebi ister. | Değişmez | Kullanıcı çalışma düzenini açıkça değiştirirse. |
| D-015 | Gerçek ad çakışması nedeniyle önceki endüstri organizasyonu adı `Nexilune Industrial` olarak değiştirildi; arşiv DOCX'teki eski ad geçersizdir. | Kabul | Yeni ad için doğrulanmış bir çakışma bulunursa aynı süreç tekrarlanır. |
| D-016 | Bağımsız `lifecycle_game_tester` her davranış görevi, faz kapısı, final release ve yayın sonrası uyumlulukta zorunludur. | Değişmez | Kullanıcı test kapsamını açıkça değiştirirse. |
| D-017 | Kaynak ledger serileştirmesi `1 kaynak = 1_000_000` mikro-birim ve half-away-from-zero tek-dönüşüm kuralını kullanır; bu bir encoding sözleşmesidir, ekonomi katsayılarını veya `balance-1.2` sürümünü değiştirmez. | Kabul | Birim ölçeği ya da yuvarlama ancak karar, model ve çapraz-çalışma zamanı kanıtı birlikte güncellenirse değişir. |
| D-018 | P2.2 tesis kataloğu beş türün seviye 1-12 şemasını tanımlar; profil tesis satırları otomatik başlangıç hibesiyle oluşturulmaz. Satır oluşturma, seviye değişimi ve maliyet uygulaması P2.5'in sunucu-otoriteli inşa akışına aittir. | Kabul | Başlangıç tesisleri ancak denge modeli, onboarding akışı ve plan kanıtıyla birlikte açıkça tasarlanırsa eklenir. |
| D-019 | P2.4 depolaması, kaynak bakiyesi için fiziksel bir global tavan değil her tesisin son talep edilmiş üretimine uygulanan 24-36 saatlik üretim-penceresi tavanıdır. Uzun çevrimdışı talep, bu penceredeki üretimi alır ve cursor `now`a ilerler. Bölünmüş-uzlaşma eşitliği, tek server settlement'ının 6 saat/konfigürasyon/queue sınırlarında geçerlidir; ayrı oyuncu talepleri yeni üretim penceresi başlatmaz. Talep sıklığı adaleti P2.7 gerçek-ledger karşılaştırmasında 24/48/72 saat ritimleriyle ölçülür. | Kabul | P2.7 gerçek ledger simülasyonu, hedeflenmeyen claim-sıklığı avantajını gösterirse depolama eğrisi/denge kararı birlikte revize edilir. |
| D-020 | P2.4'ten itibaren API, server-otoriteli settlement'ta sürümlü tesis katalogunu ve saf simülasyon paketini okuyabilir; `@nexus/api -> @nexus/content,@nexus/simulation,@nexus/contracts` yönü izinlidir. Bu izin, istemciye simülasyon/bakiye otoritesi aktarmaz ve uygulama-uygulama bağımlılığına izin vermez. | Kabul | Ayrı servis/dağıtım sınırı veya istemci otoritesi riski ölçülürse bağımlılık yönü yeniden tasarlanır. |
| D-021 | P2.4 lazy-accrual taşıması, oran/depolama sınırları arasında kesir kaybetmemek için normalize edilmiş keyfi hassasiyetli pozitif rasyonel (`numeric`/`BigInt`) olarak tutulur. Bu taşıma oyuncu bakiyesi veya ledger girdisi değildir; her yazılan bakiye ve ledger deltası D-017'nin imzalı 64-bit mikro-birim sınırında kalır. | Kabul | Depolama alanı veya performans ölçümü taşımanın sınırlandırılmasını gerektirirse, eşdeğer deterministik materializasyon/yuvarlama kuralı ve çapraz-çalışma zamanı kanıtı birlikte eklenir. |
| D-022 | P2.5 yalnız tesis inşa/yükseltme kuyruğunu uygular. Arşiv GDD'deki araştırma kuyruğu ifadesinin proje kataloğu, maliyeti, süresi, önkoşulu ve ölçülebilir etkisi bulunmadığından işlevsiz araştırma kaydı eklenmez. Sürümlü araştırma proje kataloğu ve kuyruğu, operasyon statları/bant genişliği etkisiyle birlikte P4.1'in kapsamındadır. | Kabul | Araştırma için etkilerinden bağımsız, sürümlü bir erken-ekonomi kataloğu ve P2 gerçek-ledger denge kanıtı açıkça tasarlanırsa görev yeniden Faz 2'ye alınır. |
| D-023 | P2.5 tesis kuyruğu hızlandırma/ücretli geçiş içermez. Yeni tesis hedef seviye 1'i, yükseltme hedef `mevcut+1` katalog satırını kullanır; Sermaye ve Bileşen maliyeti enqueue anında bir kez düşer, süre katalogdaki onda-dakikanın tam milisaniye karşılığıdır. Tesis yoksa bitişe kadar üretmez; yükseltmede eski seviye üretir. `now < finish_at` iptali saklanan maliyetin %100'ünü bir kez iade eder; `now >= finish_at` tamamlanma kazanır. | Kabul | P2.7 gerçek-ledger denge testi veya oyuncu araştırması, zaman/maliyet/iade eğrisinin baskı ya da enflasyon yarattığını gösterirse yeni formül sürümü ve test kanıtıyla değiştirilir. |
| D-024 | Kimlik/oturum P8.2 kapsamına gelene kadar P2.6 merkez endpoint'i profil kimliğini istemciden kabul etmez; tek oyunculu yerel prototipte yalnız sunucunun `CENTER_PROFILE_ID` yapılandırmasındaki UUID'sini kullanır ve bu değer yoksa güvenli boş durum döndürür. Çok kullanıcılı dağıtımda bu bağlam gerçek oturum guard'ından türetilmeden endpoint açılmaz. | Kabul | P8.2 kimlik, yetki ve Origin sınırı gerçeklenince yapılandırmalı bağlam kaldırılır; istemci serbest `profileId` göndermeye başlamaz. |
| D-025 | P2.7, Faz 4 operasyonu eklemeden §28.2'deki F/O/C/S karşılaştırıcısını sürümlü ve test-yalnız deterministik bir senaryo olarak mevcut PostgreSQL ledger'ına uygular. Senaryo aynı başlangıç tesis/bakiye/doktrin ile yalnız `2` ve `10` günlük operasyon niyetini değiştirir; operasyon ödülü/gideri oyun sonucu değil planın normalize edilmiş sabit karşılaştırıcısıdır. 24/48/72 saat claim ritimleri aynı senaryoda ayrıca ölçülür. Gerçek operasyon sonucu, ısı etkisi ve oyuncu ekonomisiyle final karşılaştırma P4/P9'da aynı kapıyı yeniden çalıştırır. | Kabul | Faz 4 operasyon sonuçları, P3/P4 dünya etkileri veya oyuncu verisi, test-yalnız karşılaştırıcıyı maddi olarak değiştirirse sürüm/seed/fixture ve P2.7 kanıtı birlikte yenilenir. |
| D-026 | P2.7 gerçek-ledger ritim testi, `balance-1.2`nin `0.08*ln(1+n)` aktivite karşılaştırıcısının 72 saatlik ritimde `%35.1` fark ürettiğini kanıtladı. P2 ekonomi karşılaştırıcısı bu nedenle `balance-1.3` olarak `activity_p2(n)=min(0.12,0.035*ln(1+max(0,n)))` kullanır; 2/10 günlük fark her 24/48/72 saat ritminde katı `<%20` kalmalıdır. PCG, operasyon başarı/taktik, ödül ve tespit matematiği P4'e kadar `balance-1.2`de kalır. | Kabul | Gerçek P4 operasyon çıktıları veya canlı ekonomi gözlemi bu sınırı hedefi karşılamaz kılarsa P2/P4 ortak ekonomi sürümü, fixture ve 30-günlük test birlikte değiştirilir. |
| D-027 | P3.1 `world_state`, tekil ve sunucu-otoriteli küresel kayıttır: normatif başlangıç `asteria-baseline-0.2` / `balance-1.2`, `master_seed=20260809`, değişmez `epoch_ms=1767225600000` (2026-01-01T00:00:00Z), tamamlanmış altı-saatlik çevrim sayacı ve monoton durum revizyonunu taşır. Worker yalnız PostgreSQL (`pg`) ve saf `@nexus/simulation` paketine bu kayıt için bağımlı olabilir; API↔worker uygulama bağımlılığı yoktur. İstemci seed, zaman veya çevrim sonucu gönderemez. | Kabul | Dünya başlangıcı/çoklu dünya gereksinimi, sürüm/seed/epoch migration'ı ve tekrar üretilebilirlik kanıtı birlikte tasarlanırsa. |
| D-028 | P3.2 NPC başlangıç durumu, oyuncu doktrinlerinden ayrıdır: Nexilune Industrial `centralize`/65, Asteria Civic Grid `continuity`/60, Free Mesh `distribute`/55 readiness taşır. Organizasyon kapasitesi katalogda 0-100 aralığındaki adlandırılmış vektördür; profil ilişkisi imzalı onda-puan olarak `[-1000,1000]` aralığında başlar. P3.2 bu durumu yalnız sunucuda kalıcılaştırır; çevrim davranışı, pazar, teklif, adaptasyon ve ilişki sonucu eklemez. | Kabul | P3.3+ simülasyon/oyuncu verisi başlangıç sözlüğü veya değerleri maddi olarak geçersiz kılarsa içerik sürümü, seedli fixture ve denge kanıtı birlikte güncellenir. |

## 25. Risk kaydı

| Risk | Olasılık | Etki | Erken sinyal | Azaltma |
|---|---|---|---|---|
| Strateji ve operasyon iki ayrı oyun gibi hissettirir | Orta | Çok yüksek | Oyuncu dünya sonucunu açıklayamıyor | Her sözleşmeye giriş ve çıkış dünya etkisi; P6 kapısı |
| Kaynak sayısı ilk kullanıcıyı yoruyor | Orta | Yüksek | İlk 10 dakikada yanlış kaynak yorumu | Kademeli açılım, tooltip, gerekirse kaynak azaltma |
| Tek mini oyun tekrar ediyor | Orta | Orta | Otomatik çözüm oranı hızla yükseliyor | Seed/modifier çeşitliliği; yeni mini oyun değil önce içerik varyasyonu |
| Aktif oyuncu ekonomik olarak kopuyor | Orta | Yüksek | 2/10 operasyon farkı >%20 | Logaritmik aktif bonus ve simülasyon kapısı |
| Pazar enflasyonu/çöküşü | Düşük | Yüksek | Endeks 3+ çevrim sınırda | Ortalama dönüş, koridor ve stres testi |
| NPC adaptasyonu cezalandırıcı oluyor | Orta | Orta | Araç seçeneği fiilen geçersizleşiyor | `%25` unutma ve `+10` tavan |
| Siber tema gerçek kötüye kullanım bilgisi sızdırıyor | Düşük | Çok yüksek | Gerçek komut/CVE/hedef içerikte | Güvenli içerik skill'i ve zorunlu güvenlik ajanı |
| Kapsam çok büyüyor | Yüksek | Çok yüksek | Faz dışı sistem veya ikinci mini oyun başlıyor | Faz dışı liste, tek aktif faz, karar kaydı |
| Sunucu otoritesi istemciye sızıyor | Orta | Çok yüksek | İstemci bakiye/seed/sonuç gönderiyor | Sözleşme testleri ve güvenlik kapısı |
| Worker kesintisi veri tutarsızlığı yaratıyor | Orta | Yüksek | Çift tamamlama veya kayıp iş | Idempotency, `finish_at` uzlaşması ve kesinti testi |
| İçerik üretimi teknik geliştirmeyi geçiyor | Orta | Orta | Sistem hazır ama 12 hedef gecikiyor | Sürümlü veri şeması ve P6 içerik bütçesi |

## 26. Tamamlama kanıtı

| Tarih | Görev | Kanıt | Sonuç |
|---|---|---|---|
| 2026-08-09 | P0.1-P0.3 | `GAME_PLAN.md`; plan yapısı ve karar/risk kayıtları | Geçti |
| 2026-08-09 | P0.4 | `.agents/skills/*`; `quick_validate.py` raporları | Geçti |
| 2026-08-09 | P0.5 | `.codex/agents/*.toml`, `.codex/config.toml`, `AGENTS.md` | Geçti |
| 2026-08-09 | P0.6 | `docs/phase-reports/P0-gate.md`; üç bağımsız ajan tekrar testi | Geçti |
| 2026-08-09 | P0.7-P0.8 | Bölüm 28-31; `tools/balance_model.py`; `docs/balance_results_v1.1.json` | Geçti |
| 2026-08-09 | P0.9 | `.codex/agents/lifecycle-game-tester.toml`; `docs/test-reports/TEST_REPORT_TEMPLATE.md`; doğrulama skill entegrasyonu | Geçti |
| 2026-08-09 | P1.1 | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `scripts/*.mjs`, `pnpm-lock.yaml`; temiz/çevrimdışı kurulum, 8 komut ve `quality_gate_reviewer` PASS; yaşam döngüsü smoke uygulanamaz | Geçti |
| 2026-08-09 | P1.2 | `apps/{web,api,worker}`, `packages/{contracts,simulation,content,ui}`, kök ESLint/workspace kontrolleri ve `pnpm-lock.yaml`; frozen kurulum, `pnpm --filter @nexus/web run build`, `pnpm verify`, `quality_gate_reviewer` PASS ve `docs/test-reports/P1.2-lifecycle.md` PASS | Geçti |
| 2026-08-09 | P1.3 | `infra/docker-compose.yml`, `.env.example`, `scripts/local-services-check.mjs`; PostgreSQL/Redis sağlığı, yeniden başlatma/kalıcılık smoke'u, `pnpm verify`, `quality_gate_reviewer` PASS ve `docs/test-reports/P1.3-lifecycle.md` PASS | Geçti |
| 2026-08-09 | P1.4 | `apps/api/src/migrations/*`, immutable ledger ve idempotency şeması; ileri/geri/ileri migration, sürüm pinleme, tekrar anahtarı, DELETE/TRUNCATE reddi ve geri alma veri kaybı koruması; `pnpm verify`, kalite kapısı ve `docs/test-reports/P1.4-lifecycle.md` PASS | Geçti |
| 2026-08-10 | P1.5 | `packages/contracts` test portları, `packages/simulation` PCG32/fixture ve `tools/verify_pcg_fixture.py`; TypeScript/Python golden vektörleri, stream izolasyonu, sınır/rounding testleri, `pnpm verify`, denge/kalite incelemesi ve `docs/test-reports/P1.5-lifecycle.md` PASS | Geçti |
| 2026-08-13 | P1.6 | API/worker Nest liveness endpointleri, yapılandırılmış JSON loglar, güvenli hata sözleşmesi ve request correlation; iki ardışık HTTP smoke, kalite/lifecycle PASS, PostgreSQL/Redis entegrasyonu ve `pnpm verify` PASS | Geçti |
| 2026-08-14 | P1.7 | `.github/workflows/ci.yml`, platform-bağımsız PCG fixture sarmalayıcısı; GitHub Actions run `31744637453` içinde `lint/typecheck/unit/integration` PASS ve `main` için strict required checks/PR koruması; kalite/lifecycle PASS | Geçti |
| 2026-08-14 | P1.8 | `README.md`, optional `.env` Compose/API sarmalayıcıları; varsayılan ve özel portlu yerel başlangıç/migration/entegrasyon akışı, `pnpm verify`, kalite ve `docs/test-reports/P1.8-lifecycle.md` PASS | Geçti |
| 2026-08-14 | Faz 1 kapısı | `docs/phase-reports/P1-gate.md`, `docs/test-reports/P1-lifecycle.md`; web/API/worker liveness, PostgreSQL/Redis sınırı, eşzamanlı idempotency, CI koruması ve tam doğrulama PASS | Geçti |
| 2026-08-14 | P2.1 plan netleştirmesi | Ekonomi, mimari ve güvenlik incelemeleri signed-64/scale ve eşzamanlı negatif-bakiye açığını saptadı; Bölüm 28 ve D-017 `1_000_000` mikro-birim encoding'ini sabitledi. Başlangıç hibesi, tesis oranı ve shadow-price bu görev kapsamına alınmadı. | Geçti |
| 2026-08-14 | P2.1 | `003-005` ledger migrations, `PostgresLedgerService`, D-017 Python/TypeScript fixture, legacy-backfill, idempotency/replay/conflict, profile-FK, reason allowlist ve concurrent-spend testleri; `pnpm verify`, ekonomi/güvenlik/kalite incelemeleri ve `docs/test-reports/P2.1-lifecycle.md` PASS | Geçti |
| 2026-08-14 | P2.2 plan netleştirmesi | Mimari ve ekonomi incelemeleri tesis başlangıç satırlarının/giriş hibelerinin plan dışı olduğunu belirledi; D-018 katalog ile gelecekteki inşa durumu sahipliğini ayırdı. | Geçti |
| 2026-08-14 | P2.2 | `packages/content` 5×12 tesis kataloğu, D-017 mikro-birim/tenths encoding'i ve `006_profile_facilities` migration; 60 satır formül/monotonluk, DB kısıtları/rollback, `pnpm verify`, ekonomi/kalite incelemeleri ve `docs/test-reports/P2.2-lifecycle.md` PASS | Geçti |
| 2026-08-14 | P2.3 | `packages/content` exact enerji-talep kataloğu, `packages/simulation` saf sıra-kararlı enerji çözümleyicisi ve TypeScript/Python ortak golden fixture; mikro şebeke, öncelik/kalıcı kimlik, korunum, kısmi verim oranı ve geçersiz girdi kontrolleri; `pnpm verify`, ekonomi/kalite incelemeleri ve `docs/test-reports/P2.3-lifecycle.md` PASS | Geçti |
| 2026-08-14 | P2.4 | `007_lazy_accrual` migration, atomik server settlement, final-window 24-36 saatlik depolama, depolanmış enerjiyle öncelikli kısmi verim ve D-021 canonical kesirli taşıma; TypeScript/Python ortak accrual fixture, `tools/balance_model.py` çapraz-oran korunum denetimi, `pnpm verify`, ekonomi/kalite incelemeleri ve `docs/test-reports/P2.4-lifecycle.md` PASS | Geçti |
| 2026-08-14 | P2.5 | `008_facility_queue` migration, sunucu-saatli ücretsiz tesis inşa/yükseltme kuyruğu, atomik debit/bitir/iptal-iade, profil/tür/ledger-neden FK ve trigger korumaları; hedef-seviye snapshot, yarış/idempotency, eski→yeni üretim sınırı, `pnpm verify`, mimari/ekonomi/güvenlik/kalite incelemeleri ve `docs/test-reports/P2.5-lifecycle.md` PASS | Geçti |
| 2026-08-14 | P2.6 | Sunucu-otoriteli `/v1/center` özeti, kaynak nedenleri, tam kesirli üretim tahmini ve enerji-kıtlığı açıklaması; istemciden profil kimliği kabul etmeyen D-024 bağlamı, loopback API, erişilebilir loading/error/yenile UI, `pnpm verify`, güvenlik/kalite incelemeleri ve `docs/test-reports/P2.6-lifecycle.md` PASS | Geçti |
| 2026-08-14 | P2.7 | `010_balance_1_3` sürüm pin'i, sabit `seed=20260809` ve UUID'li 30 günlük izole PostgreSQL ledger karşılaştırıcısı; 24/48/72 saat ritimlerinde 2/10 operasyon farkı sırasıyla `%2.38/%6.85/%18.43` ve katı `<%20`, `pnpm verify`, Python model/fixture denetimi, ekonomi/güvenlik/kalite incelemeleri ve `docs/test-reports/P2.7-lifecycle.md` PASS | Geçti |
| 2026-08-14 | P2.8 | D-017/D-019/D-021 için sabit LCG `seed=541065224` ile 16 overspend, 8 tam-bakiye yarışı, idempotent replay, underflow/overflow atomikliği ve heterojen cursor saat-geri-alma özellikleri; cursor gerilemesini önleyen sunucu düzeltmesi, `pnpm verify`, ekonomi/kalite incelemeleri ve `docs/test-reports/P2.8-lifecycle.md` PASS | Geçti |
| 2026-08-14 | Faz 2 kapısı | `docs/phase-reports/P2-gate.md`, `docs/test-reports/P2-lifecycle.md`; beş kaynak/tesis/enerji/accrual/queue/merkez döngüsü, 7/30 günlük gerçek-ledger ekonomi, property sınırları ve tam doğrulama PASS | Geçti |
| 2026-08-16 | P3.1 | `011-012` singleton/immutable `world_state` migrations, saf `packages/simulation` altı-saat çevrim çözümleyicisi ve worker `FOR UPDATE` runner; sınır/replay/geri-saat, migration ileri-geri, tamper/rollback, gerçek PostgreSQL eşzamanlılık/transaction-restart, `pnpm verify`, güvenlik/kalite incelemeleri ve `docs/test-reports/P3.1-lifecycle.md` PASS | Geçti |
| 2026-08-17 | P3.2 | Sürümlü üç-organizasyon kataloğu, `013_npc_organization_state` ve nötr profil-ilişki şeması; D-028 başlangıç tuple'ları, profile backfill/insert bootstrap, dünya sürüm/revizyon bağlama, eşzamanlı idempotent ilişki başlatma ve korumalı rollback; `pnpm verify`, güvenlik/kalite incelemeleri ve `docs/test-reports/P3.2-lifecycle.md` PASS | Geçti |

## 27. Değişiklik protokolü

Plan değişikliği gerektiğinde:

1. Değişikliğin tetikleyicisini ve kanıtını yaz.
2. Etkilenen görev, faz, metrik, karar ve riski belirle.
3. Yeni kapsam ekleniyorsa eşdeğer kapsam çıkar veya takvimi açıkça değiştir.
4. İlgili ajanlarla tutarlılık kontrolü yap.
5. Karar kaydına yeni kimlik ekle; eski kararın geçmişini silme.
6. Plan doğrulama betiğini çalıştır.
7. Yalnız bundan sonra kodu yeni karara göre değiştir.

## 28. Normatif matematik - `balance-1.2`

Bu bölüm Faz 2-6 sistemlerinin başlangıç matematik sözleşmesidir. `tools/balance_model.py` bunun yürütülebilir referansıdır; farklı sonuç üretirse görev kapatılamaz. `clamp(a,b,x)=max(a,min(b,x))`, `sigmoid(x)=1/(1+e^-x)`.

Yuvarlama `half-away-from-zero` kullanır: mutlak değer `10^d` ile ölçeklenir, `floor(x+0.5)` uygulanır, işaret geri konur. `round`, `round1`, `round4` sırasıyla `d=0,1,4` demektir. Olasılıklar çekilişten önce aynı kuralla 9 ondalığa quantize edilir ve `T=floor(P*2^32)` eşiğine çevrilir. Rastgele `uint32<T` ise olay olur. Ledger değerleri veritabanında tam sayı mikro-birim olarak tutulur; kayan nokta değer doğrudan bakiyeye yazılmaz. Bir mikro-birim `10^-6` kaynak birimidir; birimden mikro-birime dönüşüm `roundHalfAway(units*1_000_000)` ile bir kez, kaynakta yapılır. Saklanan ve işlem sonrası hesaplanan her değer PostgreSQL signed-64 `bigint` aralığında kalmalı; aralık dışı niyet reddedilir.

Tekrar üretilebilir rastgelelik sözleşmesi:

1. Ana seed işaretsiz 64-bit ondalık, stream kimliği kararlı UTF-8 metindir.
2. `SHA-256("formula_version|content_version|master_seed|stream_id")` hesaplanır; ilk 8 byte little-endian seed, sonraki 8 byte little-endian stream olur.
3. Üreteç `PCG-XSH-RR 32`'dir: 64-bit state taşması modulo `2^64`, çarpan `6364136223846793005`, increment `((stream<<1)|1) mod 2^64`; standart iki adımlı PCG başlatması kullanılır.
4. `uniform=(next_uint32+0.5)/2^32`. Simülasyon için yaklaşık standart normal, tam 12 uniform toplamından `6` çıkarılarak üretilir; Box-Muller/runtime trigonometrisi kullanılmaz.
5. Her domain ayrı stream taşır (`operation:<id>:success`, `operation:<id>:detection`, `market:<cycle>` gibi); bir sisteme yeni çekiliş eklemek diğer sistemlerin akışını değiştiremez.
6. `seed=20260809`, stream `golden` için ilk beş `uint32`: `1019786244, 2580556072, 2564031293, 2736638898, 3790840288`. TypeScript portu bu golden vektörü ve ortak fixture'ları birebir geçmeden Faz 1 kapanmaz.

Python araştırma modeli ile TypeScript sunucu paketi aynı eşik kararlarını birebir vermelidir. Transandantal ara değerler 9 ondalık olasılık quantizasyonundan önce en fazla `1e-12` sapabilir; eşik sonucu ve tam sayı ledger sonucu farklı olamaz.

### 28.1 Operasyon gücü ve olasılıklar

- Etkin stat: `E(x)=x` (`x<=60`), aksi halde `E(x)=60+0.55*(x-60)`.
- Saldırı: `A=0.22*E(recon)+0.24*E(access)+0.20*E(control)+0.20*E(stealth)+0.14*E(analysis)`.
- Savunma: `D=0.28*hardening+0.28*monitoring+0.22*segmentation+0.22*resilience`.
- İstihbarat: `I=0.18*ln(1+clamp(0,5,intel_units))`.
- Isı cezası: `H=max(0,heat-40)*0.006`.
- Node katkısı: `N=clamp(-0.10,0.10,(score-50)/500)`. Karşılaştırıcı nötr `50` skordur; `50→100` en çok `+10`, `50→0` en çok `-10` yüzde puandır.
- Başarı: `P_success=clamp(0.08,0.92,0.08+0.84*sigmoid((A+tool-D)/11+I+support-H)+N)`.
- Tespit: `P_detect=0.03+0.55*sigmoid((monitoring+noise+(6-0.12*score)+0.25*heat-E(stealth)-cover)/12)`.
- Başarı ve tespit iki ayrı seed'li çekiliştir; ortak skor/durum verildiğinde koşullu bağımsızdır.
- Ödül kalitesi: `Q=clamp(0.65,1.15,0.80+0.20*P_success+0.003*(score-50))`.
- Başarılı Sermaye: `base_capital*Q*(detected?0.72:1.0)*uniform(0.92,1.08)`; başarısızlık Sermaye üretmez.
- Başarılı analiz/delil: `base_evidence*Q*(detected?0.72:1.0)*uniform(0.92,1.08)`.
- Başarısız analiz/delil: `base_evidence*0.25*(detected?0.80:1.0)*uniform(0.92,1.08)`. `%25` tespit cezasından önceki tabandır.
- Isı kazanımı, hedef kademesi `t` için: başarı + tespit yok `4+2*(t-1)`; başarı + tespit `12+2*(t-1)`; başarısız + tespit yok `7+2*(t-1)`; başarısız + tespit `18+2*(t-1)`.

Eş-kademe Monte Carlo, `seed=20260809` ve profil başına en az `100000` örnekle `%60-%85` başarı bandını sağlamalıdır. Tohum tuning amacıyla değiştirilemez; farklı 30 seed regresyon paketi Faz 4'te eklenir.

### 28.2 Tesis, depolama ve ilerleme

- Saatlik çıktı: `base_output*1.24^(level-1)`.
- Sermaye maliyeti: `round(base_capital*1.55^(level-1))`.
- Bileşen maliyeti: `round(base_components*1.48^(level-1))`.
- Süre, dakika: `round1(min(360,base_minutes*1.50^(level-1)))`.
- Depolama: `min(36,round1(24+1.5*(level-1)))` saat.
- Seviye XP: `round(60*level^1.35)`; kümülatif XP, önceki seviye gereksinimlerinin toplamıdır.

| Tesis | Çıktı | Seviye-1/saat | Sermaye tabanı | Bileşen tabanı | Süre tabanı (dk) |
|---|---|---:|---:|---:|---:|
| Mikro Şebeke | Enerji | 90 | 220 | 12 | 1.5 |
| Veri Merkezi | İşlem Gücü | 150 | 260 | 18 | 2.0 |
| Robotik Atölye | Bileşen | 18 | 320 | 8 | 2.5 |
| Araştırma Laboratuvarı | Uzmanlık | 8 | 340 | 22 | 3.0 |
| Güvenlik Operasyon Merkezi | Isı Azaltımı | 0.9 | 380 | 26 | 3.0 |

Aktif/seyrek oyuncu adaleti, yalnız bonus çarpanıyla değil 30 günlük normalize ledger ile ölçülür. Aynı seed, doktrin, tesis ve sözleşme takviminde yalnız günlük operasyon sayısı değişir:

- `balance-1.2` operasyon karşılaştırıcısı `activity(n)=min(0.20,0.08*ln(1+max(0,n)))` olarak korunur; P2.7 gerçek-ledger ekonomi karşılaştırıcısı D-026 uyarınca `activity_p2(n)=min(0.12,0.035*ln(1+max(0,n)))` ve `formula_version=balance-1.3` kullanır.
- P2.7 test senaryosunda 24 saatlik tesis kredisi `F=1000`, 48/72 saatlik ritimde mevcut depolama penceresinin alınamayan üretimiyle sırasıyla `500/333.333…` olur; operasyon kredisi `O=1000*activity_p2(n)`; gider `C=0.35*O`; sink `S=0.25*(1000+O)`.
- Her ritim için `Net30=30*(F+O-C-S)` ve kapı `Net30(10)/Net30(2)-1 < 0.20`'dir.
- `balance-1.3` referansları: 24 saatte `22961.42/23507.12` (`%2.38`), 48 saatte `7961.42/8507.12` (`%6.85`), 72 saatte `2961.42/3507.12` (`%18.43`) — değerler sırasıyla 2/10 operasyon-gün içindir.
- Faz 2 gerçek kaynak shadow-price tablosunu kurar; Faz 4 gerçek operasyon sonuçlarını ledger'a bağlar. Aynı karşılaştırıcı gerçek ledger ile tekrar çalışmadan Faz 9 kapanmaz.

### 28.3 Pazar, sözleşme ve NPC adaptasyonu

- Pazar: `M_next=clamp(0.85,1.15,1+0.72*(M_prev-1)+shock)`. Yapılandırmanın doğrudan `0.85/1.15` eşitliği ve zorlanmış iki uç şok test edilir; yalnız rastgele 120 gün yeterli kanıt değildir.
- Teklif kazanma: `P_contract=0.10+0.80*sigmoid((player_score-best_npc_score)/9)`.
- Dünya çevrimi: `6 saat`.
- Maruziyet: `exposure_next=round4(max(0,0.75*exposure_prev+max(0,new_exposure)))`; önce `%25` unutma, sonra yeni maruziyet uygulanır.
- Adaptasyon: `modifier=min(10,2.5*ln(1+exposure))`; negatif olamaz ve `+10` savunma puanını aşamaz.

Bir strateji; eşdeğer risk, süre ve maliyette, temsilî seed'lerin en az `%70`'inde ikinci uygulanabilir seçeneğe karşı medyan net ilerlemede `%12`'den fazla üstünlük sağlıyorsa ve ölçülebilir bir bedeli yoksa dominant sayılır. Böyle bir seçenek faz kapısını engeller.

### 28.4 Enerji, teklif, yükleme ve dünya etkisi

Enerji uzlaşması her zaman aralığı için saf ve sıra-kararlıdır. Mikro Şebeke tüketmeden üretir. Diğer tesislerin seviye-1 talepleri Veri Merkezi `70`, Robotik Atölye `35`, Araştırma Laboratuvarı `45`, Güvenlik Operasyon Merkezi `30` Enerji/saat; seviye talebi `base_demand*1.18^(level-1)`'dir. Oyuncu önceliği `1-5` (1 önce) seçer; eşitlikte kalıcı `facility_id` sıralanır. Her tesis için `allocation=min(demand,remaining)`, `efficiency=allocation/demand`, `actual_output=nominal_output*efficiency`; ayrılan Enerji ledger'dan düşer. Uzlaşma, kuyruk bitişi ve 6 saatlik dünya çevrimi sınırlarında parçalanır; böylece uzun çevrimdışı süre ile adım adım çalışma aynı mikro-birim sonucu verir.

Sözleşme teklif girdileri `0-100` aralığındadır: `offer=0.45*preparedness+0.25*reputation+0.20*urgency_fit+0.10*price_score`; `price_score=clamp(0,100,100-100*abs(bid-fair_value)/max(1,fair_value))`. Oyuncu kazanma olasılığı 28.3 formülünü kullanır. Teminat hedefi `round(base_reward*(0.05+0.03*tier))`, bloke edilen tutar `min(target_collateral,round(0.20*liquid_capital))` olur ve coverage teklif kaydında görünür. Başarı/sistem iptalinde `%100`, normal başarısızlıkta `%75`, oyuncu terkinde `%50` iade edilir; aynı event kimliği ikinci iade üretemez.

Yükleme Bant kapasitesi `B=clamp(12,40,10+2*data_center_level+floor(bandwidth_research/5))`; yükleme en az bir araç içerir, araç maliyetleri içerikte `1-10` tam sayıdır ve toplam `<=B` olmalıdır. Modlar:

| Mod | Başarı `support` | Tespit yüzde puanı | Ödül | Son ısı |
|---|---:|---:|---:|---:|
| Sessiz | `0.00` | `-0.05` | `x0.95` | `-2` |
| Dengeli | `0.00` | `0` | `x1.00` | `0` |
| Hızlı | `+0.08` | `+0.08` | `x1.05` | `+4` |

Tespit mod değişiminden sonra `clamp(0.03,0.85,P_detect+delta)` olur; ısı hiçbir zaman negatif yazılmaz. Keşif başlamadan geri çekilme ayrılmış Enerji/İşlem Gücü/İstihbaratın `%100`'ünü; keşif sonrası fırlatma öncesi geri çekilme Enerji/İşlem Gücü'nün `%80`'ini ve harcanmamış İstihbaratın `%100`'ünü iade eder. Fırlatma sonrası oyuncu geri çekilmesi kaynak iadesi vermez fakat başarısız analiz değeri üretir. Sunucu hatasında `%100` idempotent iade zorunludur.

Node Routing geçerli yolundaki kenarlar `risk`, `latency`, `packet_delivery` taşır. `R=100-weighted_mean(risk)`, `L=100*clamp(0,1,1-total_latency/max_latency)`, `K=100*clamp(0,1,delivered/required)` ve `score=round(clamp(0,100,0.45*R+0.30*L+0.25*K-20*invalid_edge_count))`. Geçersiz yol operasyonu başlatamaz; atlama skoru `50`'dir.

Planlı çözüm yalnız aynı formül/içerik sürümünde en az 3 başarı, `P_detect(score=50)<=0.25` ve `P_raw>=0.78` koşulunda açılır. `P_raw=P_success(score=50)+min(0.06,0.02*mastered_successes)`, `P_auto=clamp(0.78,0.88,P_raw)`; aynı maliyet, ödül ve seed akışını kullanır, yalnız Node skoru `50` kabul edilir.

Dünya eksenleri İstikrar, Özerklik, Refah ve Etki için `0-100` aralığındadır. Sonuç derecesi başarı+tespit yok `1.00`, başarı+tespit `0.65`, başarısız+tespit yok `-0.25`, başarısız+tespit `-0.60`, geri çekilme `-0.15` olur. İçerik vektörü `v_axis∈[-1,1]` için `delta_axis=round1(clamp(-8,8,8*grade*v_axis))` ve `axis_next=round1(clamp(0,100,axis_current+delta_axis))`; faction hizası `a∈[-1,1]` için `delta_relation=round1(clamp(-10,10,6*grade*a))`, ilişki ise `[-100,100]` aralığına sıkıştırılır. Bütün güncellemeler tek olay kimliğiyle atomik ve idempotent uygulanır.

## 29. Benchmark sözleşmesi

Ölçüm raporu donanım, işletim sistemi, tarayıcı/runtime sürümü, commit, içerik/formül sürümü, seed, veri seti, ısınma ve ölçüm süresini yazmadan geçerli değildir.

| Alan | Referans profil ve yöntem | Kapı |
|---|---|---|
| Web istemcisi | 4 fiziksel çekirdek/8 thread, 16 GB RAM, WebGL2 uyumlu entegre GPU; 1440x900 ve 1920x1080; test günündeki kararlı Chrome, Edge ve Firefox sürümleri kaydedilir | Kritik akışlarda tarayıcılar arası davranış eşitliği |
| Node Routing | Referans istemcide 5 dk ısınma + 10 dk ölçüm, üç seed sınıfı, en az 30 koşu | Medyan `>=60 FPS`, p95 frame time `<=25 ms`, 200 ms üzeri long task `0` |
| API | 4 vCPU/8 GB uygulama, 2 vCPU/4 GB PostgreSQL, 1 vCPU/1 GB Redis; 100 eşzamanlı sanal kullanıcı; 15 dk ısınma + 30 dk ve en az 50000 istek | p95 `<250 ms`, hata `<%0.5` |
| Durum olayları | Aynı sunucu profili; en az 10000 olay, kuyruk gecikmesi dahil | Uçtan uca p95 `<500 ms`, kayıp olay `0` |
| Dayanıklılık | Worker/Redis yeniden başlatma ve tekrar teslim; en az 10000 idempotent iş | Çift ledger kaydı ve kayıp tamamlanma `0` |

“Üretim benzeri ortam”; production topolojisi, migration yolu, kuyruk ayarları ve özellik bayraklarıyla eşdeğer; sentetik sırlar ve anonim seed'li veri kullanan izole ortamdır. Faz 8 ölçüm komutlarını `pnpm perf:*` altında sabitler; Faz 10 aynı profili yeniden çalıştırır.

## 30. Hata şiddeti ve risk kabulü

| Seviye | Tanım | Kapı etkisi |
|---|---|---|
| P0 Kritik | Veri kaybı/çoğaltma, güvenlik ihlali, yetkisiz değer üretimi, ana akışın herkes için çalışmaması veya geri dönüşsüz save bozulması | Faz ve yayın kesin engelli; risk kabulü yok |
| P1 Yüksek | Ana özelliğin önemli kohortta çalışmaması, yanlış ekonomi/sonuç, erişilebilir ana akış engeli veya güvenilir çözümü olmayan ciddi performans sorunu | Faz ve yayın engelli; yalnız düzeltme ile kapanır |
| P2 Orta | Sınırlı kapsamlı yanlışlık veya belgelenmiş makul geçici çözümü olan sorun | Faz 9/10'da ürün sahibi + teknik sorumlu yazılı kabulü, sahip, son tarih ve yeniden değerlendirme sürümüyle geçici kabul edilebilir |
| P3 Düşük | Kozmetik, metin veya düşük etkili bakım sorunu | Backlog'a kanıt ve sahip ile alınabilir |

Şiddeti kalite ajanı önerir, ana ajan kanıtlar; ürün sahibi go/no-go kararını verir. Waiver yalnız P2/P3 için, tek sürümlü ve `docs/phase-reports/` içinde izlenebilir olabilir. P0/P1 sayısı faz ve yayın kapısında `0` olmalıdır.

Çok oyunculu girişinde “kontrol dışı enflasyon”; olay etkileri ayrıştırıldıktan sonra 30 günlük medyan çekirdek fiyat sapmasının `%10`'u aşması veya yedi günlük para kaynak/sink oranının `0.90-1.10` dışında kalmasıdır. “Dominant doktrin” 28.3'teki `%12/%70` eşiğini kullanır.

## 31. Asteria içerik tabanı ve güvenli içerik manifesti

### 31.1 Organizasyonlar, görevler ve hedefler

| Organizasyon | Ana amaç | Sistem gücü | Yapısal zayıflık |
|---|---|---|---|
| Nexilune Industrial | Verim, kâr ve merkezi kontrol | İşlem Gücü, endüstri ve yüksek teklif kapasitesi | Kamu güveni ve yüksek görünürlük |
| Asteria Civic Grid | Hizmet sürekliliği ve bölgesel istikrar | Dayanıklılık, ilişki ve kriz kapasitesi | Yavaş karar ve sınırlı esneklik |
| Free Mesh | Özerklik ve dağıtık erişim | İstihbarat, gizlilik ve hızlı uyarlama | Sermaye ve Bileşen kıtlığı |

Üç görev türü yalnız soyut sistem kararları kullanır: **Erişim Değerlendirmesi** keşif/erişim ağırlıklı, **Gölge Nakil** gizlilik/analiz ağırlıklı, **Hizmet Baskısı** kontrol/dayanıklılık ağırlıklıdır. Hiçbiri gerçek komut, ürün, CVE veya uygulanabilir saldırı adımı içermez.

On iki başlangıç hedefi: Nexilune için Çevre Telemetrisi (`T1`), Tedarik Borsası (`T2`), Araştırma Arşivi (`T3`), Otonom Döküm Çekirdeği (`T5`); Civic Grid için Mahalle Rölesi (`T1`), Depolama Dağıtıcısı (`T2`), Bölgesel Denge Ağı (`T3`), Kriz Koordinasyon Çekirdeği (`T4`); Free Mesh için Kooperatif Rölesi (`T1`), İtibar Defteri (`T2`), Gezici Yönlendirme Ağı (`T3`), Federasyon Uzlaşı Düğümü (`T4`). Bunlar kurmaca adlardır ve gerçek kurum/altyapı eşlemesi taşımaz.

### 31.2 Asteria Enerji Krizi dikey kesiti

| Kimlik | Sözleşme | Görev türü | Ana karar ve eksen niyeti `(İstikrar, Özerklik, Refah, Etki)` |
|---|---|---|---|
| A01 | Kesinti Sinyalleri | Erişim Değerlendirmesi | Veriyi Civic veya Mesh ile paylaş; `(1, 0.5, 0, 0.5)` |
| A02 | Sessiz İhale | Gölge Nakil | Nexilune teklifine karşı kamu yararı/serbest pazar tercihi; `(0, 0.5, 1, 0.5)` |
| A03 | Parçalı Dağıtım | Hizmet Baskısı | Kıt kapasiteyi merkezileştir veya dağıt; `(1, 1, 0, 0.5)` |
| A04 | Üçlü Protokol | Erişim Değerlendirmesi | Üç organizasyondan birinin doktrin desteğini seç; seçime bağlı imzalı vektör |
| A05 | Yeniden Başlatma Penceresi | Gölge Nakil + Node Routing | Yüksek riskli geçici denge veya yavaş güvenli toparlanma; `(1, 0.5, 0.5, 1)` |
| A06 | Asteria Mutabakatı | Hizmet Baskısı | Önceki eksen ve ilişkilerden türeyen final; tek “doğru” organizasyon yok |

Üç dünya olayı: `E01 Talep Dalgası` pazar şoku `+0.09` ve Enerji talebi `x1.10`; `E02 Geri Kazanılan Kapasite` pazar şoku `-0.08` ve iki çevrim üretim `x1.05`; `E03 Güven Soruşturması` son üç tespit edilmiş operasyon için ilişki etkisini `x1.25` yapar, yoksa etkisizdir. Her olay başlangıç/bitiş çevrimi ve seed'iyle olay günlüğüne yazılır.

Dört ilk doktrin aynı anda yalnız bir tane etkin olacak şekilde: **Sessiz Analist** `stealth+6`, `cover+2`, ödül `x0.95`; **Sistem Mühendisi** tesis Enerji talebi `x0.94`, yükseltme süresi `x1.05`; **Sözleşme Aracısı** teklif puanı `+6`, operasyon ödülü `x0.95`; **Hızlı Operatör** başarı support `+0.05`, tespit `+0.05`, son ısı `+2`. Her doktrin 28.3 dominance kapısını geçmelidir.

### 31.3 Güvenli içerik kanıt manifesti

Faz 8'de `docs/security/content-review-<content_version>.json` üretilir. Operasyon, hedef, görev metni, fixture ve oyuncuya görünen ilgili içerik dosyalarının her biri tam bir kez listelenir. Her kayıt `path`, `sha256`, `content_version`, `reviewer`, `reviewed_at`, `result`, `finding_ids` alanlarını taşır. Dosya özeti değişirse eski `PASS` geçersizdir. Eksik, yinelenen veya `PASS` dışındaki kayıt P8.8 ve ilgili içerik fazını engeller.

## 32. Sürüm günlüğü

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 2026-08-09 | Birleşik PvE ürün planı, Faz 0-10, çok oyunculu geçiş, ajan/skill ve kalite kapıları oluşturuldu. |
| 1.1 | 2026-08-09 | Bağımsız ajan bulgularıyla görev/faz kapıları ayrıldı; `balance-1.2`, benchmark, hata şiddeti ve içerik kanıt manifesti sabitlendi. |
| 1.2 | 2026-08-09 | Platformlar arası PCG32 sözleşmesi, merkezi sistem denklemleri, Asteria içerik tabanı ve çakışmasız Nexilune adı eklendi. |
| 1.3 | 2026-08-09 | Görev smoke, her faz regresyonu, final release kabulü ve yayın sonrası uyumluluk için bağımsız yaşam döngüsü test ajanı eklendi. |
