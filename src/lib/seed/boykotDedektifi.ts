import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionSlug, Payload, Where } from 'payload'
import type { ExpertRule } from '@/payload-types'
import { slugify } from '@/lib/slugify'

/**
 * "Boykot Dedektifi" uzmanını, konusunu, derecelendirme ölçeğini, marka kayıtlarını
 * ve uzman kurallarını kuran veri seti.
 *
 * Kanıt hiyerarşisi (kuralın hangi dereceyi aldığını bu belirler):
 *  1. BDS hareketinin yayımlanmış hedef listeleri / kampanyaları → "Boykotlu"
 *  2. İşgal altındaki topraklarda üretim (GS1 prefix 729) → "Boykotlu"
 *  3. Türkiye'deki tüketici boykot listeleri (BDS resmî listesinde değil) → "Şüpheli"
 *
 * Kaynaklar 2026-10-18 tarihinde doğrulandı.
 */

export type SeedSource = { title: string; url: string }

const BDS_GUIDE: SeedSource = {
  title: 'BDS Hareketi — Boykot & Baskı Şirket Hedefleme Rehberi (30 Kasım 2024)',
  url: 'https://www.bdsmovement.net/sites/default/files/2024-12/Guide%20to%20BDS%20Boycott%20&%20Pressure%20Corporate%20Priority%20Targeting-30%20Nov%202024-Submitted%20by%20BDS%20movement.pdf',
}
const BDS_CAMPAIGNS: SeedSource = {
  title: 'BDS Hareketi — Güncel Kampanyalar',
  url: 'https://bdsmovement.net/campaigns',
}
const TR_FOOD_LIST: SeedSource = {
  title: "Boykot.co — Gıda Markaları Boykot Listesi (İsrail'i destekleyen markalar)",
  url: 'https://www.boykot.co/c/yiyecek-11',
}
const TR_COFFEE_LIST: SeedSource = {
  title: 'Boykot.co — Kahve Markaları Boykot Listesi',
  url: 'https://www.boykot.co/c/kahve-3',
}
const TR_MARKET: SeedSource = {
  title: 'Boykot Market — İşaretli marka veritabanı',
  url: 'https://www.boykotmarket.com/en/',
}
const TR_NEWS_STARBUCKS: SeedSource = {
  title: "Starbucks Türkiye: 'İsrail'le ilişkimiz yok' açıklaması (Ocak 2024)",
  url: 'https://www.barandergisi.net/boykot-etkisi-starbucks-turkiyeden-satislar-dusunce-israille-iliskimiz-yok-aciklamasi',
}

type CompanyTier = 'boykot' | 'supheli'

type Company = {
  /** Ana şirket / grup adı (kural açıklamasında geçer) */
  label: string
  /** Marka merkezinin bulunduğu ülke */
  country: string
  tier: CompanyTier
  /** Kullanıcıya gösterilecek, kaynağa dayalı gerekçe */
  summary: string
  sources: SeedSource[]
  /** Bu şirkete bağlı, raflarda karşılaşılan markalar */
  brands: string[]
}

/**
 * BDS resmî hedefi olan şirketler (tüketici öncelikli + taban/organik + baskı hedefleri
 * ve sürmekte olan BDS kampanyaları). Markaları `isBoycotted` işaretlenir; kapsam
 * "Marka Boykot Listesinde" kuralıyla sağlanır.
 */
const TARGET_COMPANIES: Company[] = [
  {
    label: 'Chevron (Caltex, Texaco)',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "ABD merkezli Chevron, Doğu Akdeniz'de işgal altındaki Filistin doğal gaz sahalarını çıkararak İsrail'in savaş kasasını ve apartheid sistemini güçlendiriyor; Filistinlilerin doğal kaynak egemenliğini engelliyor. BDS'nin tüketici boykotu öncelikli hedeflerinden biridir ve #BoycottChevron kampanyası sürüyor.",
    sources: [BDS_GUIDE, { title: 'BDS — Chevron kampanyası', url: 'https://bdsmovement.net/chevron' }],
    brands: ['Chevron', 'Caltex', 'Texaco'],
  },
  {
    label: 'Intel',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Intel on yıllardır İsrail'in en büyük yabancı yatırımcısıdır. Aralık 2023'te Gazze soykırımı sürerken 25 milyar dolarlık yatırım duyurdu; Haziran 2024'te BDS baskısı sonucu projeden vazgeçti. Kiryat Gat tesisi, etnik olarak temizlenip yıkılan Irak el-Manshiya köyünün arazisi üzerinde kuruludur.",
    sources: [BDS_GUIDE],
    brands: ['Intel'],
  },
  {
    label: 'Dell Technologies',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Dell, 2023'te ABD dış yardımıyla finanse edilen 150 milyon dolarlık sözleşmeyle İsrail ordusuna sunucu, servis ve ilgili ekipman sağlıyor; Necef'te yasadışı yerleşimleri güçlendiren Ar-Ge faaliyeti yürütüyor. Kurucu ve CEO Michael Dell, Gazze soykırımının birinci ayında 350 milyon dolar değerinde hisseyi İsrail'e bağışladı.",
    sources: [BDS_GUIDE],
    brands: ['Dell'],
  },
  {
    label: 'Siemens',
    country: 'Almanya',
    tier: 'boykot',
    summary:
      "Siemens, işgal altındaki İsrail yerleşimlerini Avrupa'ya bağlayacak Euro-Asia Interconnector denizaltı elektrik kablosunun ana yüklenicisidir. Siemens markalı elektrikli ev aletleri dünya genelinde satılmaktadır.",
    sources: [BDS_GUIDE],
    brands: ['Siemens'],
  },
  {
    label: 'Hewlett Packard (HP / HPE)',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "HP Inc. ve Hewlett Packard Enterprise; İsrail hükümeti, ordusu, cezaevleri ve polisiyle kurduğu teknoloji ve lojistik destek üzerinden işgali, yasadışı yerleşim inşasını ve apartheid sistemini kolaylaştırıyor. HPE, İsrail Nüfus ve Göç İdaresi'nin veritabanı ve BT sistemlerini sağlıyor; HP Inc. ise Netanyahu ve Smotrich ofislerine servis veriyor. BDS'nin en uzun süreli boykot kampanyalarından birinin hedefidir.",
    sources: [BDS_GUIDE, { title: 'BDS — Boycott HP', url: 'https://bdsmovement.net/boycott-hp' }],
    brands: ['HP', 'Hewlett Packard Enterprise'],
  },
  {
    label: 'Carrefour',
    country: 'Fransa',
    tier: 'boykot',
    summary:
      "Carrefour, işgal altındaki yerleşimlerde faaliyet gösteren Electra Consumer Products ve Yenot Bitan ile franchise ortaklığı kurdu; Gazze'de savaşan İsrail askerlerine hediye paketleri dağıttı ve işgal altındaki topraklarda en az bir Carrefour markalı şube bulunuyor. BDS, Karrefour'a karşı küresel boykot kampanyası yürütüyor.",
    sources: [BDS_GUIDE, { title: 'BDS — Boycott Carrefour', url: 'https://bdsmovement.net/boycott-carrefour' }],
    brands: ['Carrefour'],
  },
  {
    label: 'AXA',
    country: 'Fransa',
    tier: 'boykot',
    summary:
      "AXA, 30 Haziran 2024 itibarıyla İsrail'i silahlandıran on bir şirkette 150,43 milyon dolar tutarında varlık (78,87 milyon dolar hisse + 71,56 milyon dolar tahvil) bulunduruyor; bu şirketler arasında Boeing ve General Dynamics de var.",
    sources: [BDS_GUIDE, { title: 'BDS — AXA Divest', url: 'https://bdsmovement.net/axa-divest' }],
    brands: ['AXA'],
  },
  {
    label: 'Disney / Marvel',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "BDS, Disney+ aboneliklerinin iptal edilmesi çağrısı yapıyor: Disney ve iştiraki Marvel, kendilerini açıkça İsrail'in kültür elçisi olarak tanımlayan oyuncularla İsrail propagandasına aracılık ediyor.",
    sources: [BDS_GUIDE],
    brands: ['Disney+', 'Marvel'],
  },
  {
    label: 'SodaStream',
    country: 'İsrail',
    tier: 'boykot',
    summary:
      "İsrail merkezli SodaStream, Necef'te (Naqab) Bedevi-Filistinli vatandaşların yerinden edilmesi politikasında etkin rol oynuyor ve Filistinli işçilere karşı uzun süreli ayrımcılık geçmişi bulunuyor. İsrail menşeli bir şirket olduğu için zaten 'İsrail Menşeli Ürün' kuralı da kapsıyor.",
    sources: [BDS_GUIDE],
    brands: ['SodaStream'],
  },
  {
    label: 'RE/MAX',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "RE/MAX, çalınmış Filistin toprakları üzerine kurulmuş yasadışı İsrail yerleşimlerinde mülk pazarlayarak Batı Şeria'nın kolonizasyonunu mümkün kılıyor.",
    sources: [BDS_GUIDE],
    brands: ['RE/MAX'],
  },
  {
    label: "McDonald's",
    country: 'ABD',
    tier: 'boykot',
    summary:
      "BDS, İsrail'deki şube ve franchise sahiplerinin apartheid İsrail'e açık destek verdiği ve İsrail ordusuna bağışta bulunduğu gerekçesiyle McDonald's'a yönelik taban (organik) boykot kampanyalarını destekliyor.",
    sources: [BDS_GUIDE],
    brands: ["McDonald's"],
  },
  {
    label: 'The Coca-Cola Company',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Coca-Cola, BDS'nin resmî olarak desteklediği taban (organik) boykot hedefleri arasındadır: İsrail'deki şube ve franchise yapıları apartheid İsrail'e açık destek vermiş ve orduya bağışta bulunmuştur. Coca-Cola'nın alt markaları da aynı şirkete bağlıdır.",
    sources: [BDS_GUIDE],
    brands: ['Coca-Cola', 'Fanta', 'Sprite', 'Fuse Tea', 'Cappy', 'Damla', 'Doğadan', 'Powerade'],
  },
  {
    label: 'Burger King',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Burger King, BDS'nin desteklediği taban (organik) boykot hedefleri arasındadır; İsrail'deki şube yapısı apartheid İsrail'e açık destek vermiştir.",
    sources: [BDS_GUIDE],
    brands: ['Burger King'],
  },
  {
    label: "Papa John's",
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Papa John's, BDS'nin desteklediği taban (organik) boykot hedefleri arasındadır; İsrail'deki şube yapısı apartheid İsrail'e açık destek vermiştir.",
    sources: [BDS_GUIDE],
    brands: ["Papa John's"],
  },
  {
    label: 'Pizza Hut',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Pizza Hut, BDS'nin desteklediği taban (organik) boykot hedefleri arasındadır; İsrail'deki şube yapısı apartheid İsrail'e açık destek vermiştir.",
    sources: [BDS_GUIDE],
    brands: ['Pizza Hut'],
  },
  {
    label: 'Wix',
    country: 'İsrail',
    tier: 'boykot',
    summary:
      "İsrail merkezli Wix, BDS'nin desteklediği taban (organik) boykot hedefleri arasındadır; şirketin İsrail'deki yapısı apartheid rejime açık destek vermiştir.",
    sources: [BDS_GUIDE],
    brands: ['Wix'],
  },
  {
    label: 'Microsoft',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "BDS, Microsoft'u İsrail'in yasadışı apartheid rejiminin en suç ortaklığı yapan teknoloji şirketi olarak tanımlıyor ve Xbox'a yönelik boykot taahhüdü kampanyası yürütüyor.",
    sources: [
      BDS_CAMPAIGNS,
      { title: "BDS — Microsoft kampanyası", url: 'https://bdsmovement.net/microsoft' },
    ],
    brands: ['Microsoft', 'Xbox'],
  },
  {
    label: 'Reebok',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Reebok, yasadışı İsrail yerleşimlerindeki takımları resmî liginde barındıran ve bu takımları korumak için İsrail hükümetiyle birlikte lobi yapan İsrail Futbol Federasyonu'nun (IFA) sponsorudur.",
    sources: [
      BDS_CAMPAIGNS,
      { title: 'BDS — Boycott Reebok', url: 'https://bdsmovement.net/boycott-reebok' },
    ],
    brands: ['Reebok'],
  },
  {
    label: 'Cisco',
    country: 'ABD',
    tier: 'boykot',
    summary:
      "Cisco'nun işgal altındaki Filistin topraklarındaki yasadışı yerleşimlerdeki operasyonları, ayrımcı politikaları ve İsrail kurumlarıyla uzun süreli ortaklığı belgelenmiştir; BDS bu şirkete yönelik kampanya yürütüyor.",
    sources: [BDS_CAMPAIGNS, { title: 'BDS — Cisco kampanyası', url: 'https://bdsmovement.net/cisco' }],
    brands: ['Cisco'],
  },
  {
    label: 'FANUC',
    country: 'Japonya',
    tier: 'boykot',
    summary:
      "Japon FANUC, İsrail'in en büyük silah üreticisi Elbit Systems'in kullandığı robotları üretiyor. Bu robotlar Gazze'ye karşı kullanılan 155 mm top mermilerinin üretiminde kritik role sahip; BDS 'Stop FANUC' kampanyası yürütüyor.",
    sources: [
      BDS_CAMPAIGNS,
      { title: 'BDS — Stop FANUC', url: 'https://bdsmovement.net/stop-fanuc' },
    ],
    brands: ['FANUC'],
  },
  {
    label: 'Elbit Systems',
    country: 'İsrail',
    tier: 'boykot',
    summary:
      "İsrail merkezli Elbit Systems, ülkenin en büyük silah üreticisidir ve Gazze'ye karşı kullanılan mühimmatın üretiminde baş aktördür. İsrail menşeli olduğu için 'İsrail Menşeli Ürün' kuralı da kapsar.",
    sources: [{ title: 'BDS — Stop FANUC', url: 'https://bdsmovement.net/stop-fanuc' }],
    brands: ['Elbit Systems'],
  },
  {
    label: 'Maersk',
    country: 'Danimarka',
    tier: 'boykot',
    summary:
      "Maersk, ABD'den İsrail'e askeri kargo taşıyor ve ABD'deki silah üreticilerine askeri yük taşıyarak soykırıma lojistik destek sağlıyor. BDS'in ortak yürüttüğü 'Mask off Maersk' kampanyasının hedefidir.",
    sources: [
      BDS_CAMPAIGNS,
      { title: 'BDS — Mask off Maersk', url: 'https://bdsmovement.net/MaskOfMaersk' },
    ],
    brands: ['Maersk'],
  },
  {
    label: 'Barclays',
    country: 'Birleşik Krallık',
    tier: 'boykot',
    summary:
      "Araştırmalar Barclays'in, silahları ve askeri teknolojisi İsrail saldırılarında kullanılan dokuz şirkette 2 milyar sterlinden fazla hisse bulundurduğunu ve bu şirketlere 6,1 milyar sterlin kredi ve aracılık sağladığını ortaya koydu.",
    sources: [
      BDS_CAMPAIGNS,
      { title: 'BDS — Boycott Barclays', url: 'https://bdsmovement.net/boycott-barclays' },
    ],
    brands: ['Barclays'],
  },
  {
    label: 'BNP Paribas',
    country: 'Fransa',
    tier: 'boykot',
    summary:
      "BNP Paribas, işgal altındaki Filistin topraklarını yasadışı biçimde işgal eden İsrail'in apartheid ve kolonizasyon rejimine verdiği finansal destek nedeniyle Attac ve AFPS'in yürüttüğü kampanyanın hedefidir.",
    sources: [
      BDS_CAMPAIGNS,
      { title: 'BDS — BNP Paribas', url: 'https://bdsmovement.net/bnp-paribas' },
    ],
    brands: ['BNP Paribas'],
  },
  {
    label: 'CAF',
    country: 'İspanya',
    tier: 'boykot',
    summary:
      "İspanyol vagon üreticisi CAF, yasadışı İsrail yerleşimlerini Batı Kudüs'e bağlayan JLR 'Kırmızı Hattı'nı işletiyor ve yeni 'Yeşil Hat'ı inşa ediyor.",
    sources: [BDS_CAMPAIGNS, { title: "BDS — CAF Get Off Israel's Apartheid Train", url: 'https://bdsmovement.net/boycott-caf' }],
    brands: ['CAF'],
  },
]

/**
 * BDS'in "baskı hedefleri": BDS bunlar için baskı kampanyası yürütüyor ve makul
 * alternatif varsa boykot çağrısı yapıyor. Bu yüzden "Şüpheli" derecesi verilir.
 */
const PRESSURE_COMPANIES: Company[] = [
  {
    label: 'Google',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Google, Amazon ile birlikte 2021'de imzalanan 1,22 milyar dolarlık Project Nimbus sözleşmesiyle İsrail hükümetine ve ordusuna bulut altyapısı ile yapay zeka hizmeti sağlıyor; Nimbus, ordunun 'Lavender' ve 'Gospel' gibi ölümcül yapay zeka programlarını çalıştırdığı platformdur. Nisan 2024'te Google, İsrail ordusuyla yeni bir sözleşme daha imzaladı.",
    sources: [BDS_GUIDE, { title: 'BDS — No Tech for Apartheid', url: 'https://bdsmovement.net/no-tech-apartheid' }],
    brands: ['Google'],
  },
  {
    label: 'Amazon',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Amazon, Project Nimbus kapsamında İsrail hükümetine ve ordusuna bulut altyapısı ve yapay zeka hizmeti sağlıyor; BDS mümkün olduğunda Amazon yerine doğrudan üreticiden alışveriş yapılmasını öneriyor. Ring kameraları da aynı şirketin iştirakidir.",
    sources: [BDS_GUIDE, { title: 'BDS — No Tech for Apartheid', url: 'https://bdsmovement.net/no-tech-apartheid' }],
    brands: ['Amazon', 'Ring'],
  },
  {
    label: 'Booking Holdings',
    country: 'Hollanda',
    tier: 'supheli',
    summary:
      "Booking.com, çalınmış Filistin toprakları üzerindeki yasadışı İsrail yerleşimlerinde tatil evi ve otel hizmeti sunarak işgali doğrudan destekliyor ve bundan kâr ediyor. Şirket BM'nin yasadışı yerleşim girişimi veritabanında listelidir.",
    sources: [
      BDS_GUIDE,
      { title: 'BDS — Booking.com: Stop Profiting from War Crimes', url: 'https://bdsmovement.net/bookingcom-stop-profiting-war-crimes' },
    ],
    brands: ['Booking.com'],
  },
  {
    label: 'Airbnb',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Airbnb, yasadışı İsrail yerleşimlerinde kiralık konaklama ilanları sunuyor ve BM'nin yasadışı yerleşim girişimi veritabanında listelidir.",
    sources: [BDS_GUIDE],
    brands: ['Airbnb'],
  },
  {
    label: 'Expedia Group',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Expedia, yasadışı İsrail yerleşimlerinde konaklama hizmeti sunuyor ve BM'nin yasadışı yerleşim girişimi veritabanında listelidir.",
    sources: [BDS_GUIDE],
    brands: ['Expedia'],
  },
  {
    label: 'Teva Pharmaceutical Industries',
    country: 'İsrail',
    tier: 'supheli',
    summary:
      "İsrail merkezli Teva, Ekim 2023'ten bu yana İsrail'in Gazze'deki soykırımına destek veriyor ve on yıllardır işgal sayesinde Filistin pazarını sömürüyor. BDS, makul jenerik alternatifler bulunduğunu belirterek baskı kampanyası yürütüyor.",
    sources: [BDS_GUIDE],
    brands: ['Teva'],
  },
]

/**
 * Türkiye'de yaygın tüketici boykot listelerinde (boykot.co, boykotmarket.com) yer alan,
 * ancak BDS'nin resmî hedef listelerinde doğrudan bulunmayan şirketler → "Şüpheli".
 * Bu katman doğrulama bekliyor; "Boykotlu" ile eşitlenmez.
 */
const trListCompany = (label: string, brandName: string, country = 'ABD'): Company => ({
  label,
  country,
  tier: 'supheli',
  summary: `${label} şirketinin işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. "${brandName}" markası Türkiye'deki tüketici boykot listelerinde yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.`,
  sources: [TR_FOOD_LIST, TR_MARKET],
  brands: [brandName],
})

const TR_LIST_COMPANIES: Company[] = [
  {
    label: 'PepsiCo',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "PepsiCo'nun işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Pepsi', 'Yedigün', 'Fruko', '7Up', "Lay's", 'Doritos', 'Ruffles', 'Cheetos', 'Çerezza', 'Rocco'],
  },
  {
    label: 'Nestlé',
    country: 'İsviçre',
    tier: 'supheli',
    summary:
      "Nestlé'nin işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Nescafé', 'KitKat', 'Damak', 'Crunch', 'Polo', 'Maggi', 'Nesquik', 'Purina'],
  },
  {
    label: 'Unilever',
    country: 'Birleşik Krallık',
    tier: 'supheli',
    summary:
      "Unilever'in işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Algida', 'Cornetto', 'Magnum', "Carte d'Or", 'Viennetta', 'Lipton', 'Knorr', 'Calvé', 'Becel'],
  },
  {
    label: 'Mars Inc.',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Mars'ın işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Snickers', 'Twix', "M&M's", 'Bounty', 'Milky Way', 'Mars', 'Skittles', 'Orbit', 'Eclipse'],
  },
  {
    label: 'Mondelez International',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Mondelez'in işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Oreo', 'Milka', 'Cadbury', 'Toblerone'],
  },
  {
    label: 'Danone',
    country: 'Fransa',
    tier: 'supheli',
    summary:
      "Danone'nin işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Activia', 'Danette', 'Danino', 'Tikveşli', 'Evian', 'Alpro'],
  },
  {
    label: 'Ferrero',
    country: 'İtalya',
    tier: 'supheli',
    summary:
      "Ferrero'nun işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Nutella', 'Kinder', 'Ferrero Rocher', 'Tic Tac'],
  },
  {
    label: 'Kraft Heinz',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Kraft Heinz'in işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yaygın olarak yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Heinz', 'ABC'],
  },
  {
    label: 'Kellanova',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Kellanova'nın işgal veya apartheid ile doğrudan bağlantısını gösteren BDS kararı bulunamadı. Marka, Türkiye'deki tüketici boykot listelerinde yer aldığı için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_FOOD_LIST, TR_MARKET],
    brands: ['Pringles'],
  },
  {
    label: 'Starbucks Corporation',
    country: 'ABD',
    tier: 'supheli',
    summary:
      "Starbucks, BDS'nin resmî hedef listesinde yer almıyor; şirket Ocak 2024'te 'İsrail ile ilişkimiz yok' açıklaması yaptı. Buna karşılık Türkiye'de en yaygın boykot edilen markalardan biri olduğu için 'Şüpheli' işaretlendi; doğrulama bekliyor.",
    sources: [TR_COFFEE_LIST, TR_MARKET, TR_NEWS_STARBUCKS],
    brands: ['Starbucks'],
  },
  trListCompany("Domino's Pizza, Inc.", "Domino's Pizza"),
  trListCompany('Yum! Brands', 'KFC'),
  trListCompany('Subway (Roark Capital)', 'Subway'),
  trListCompany('Restaurant Brands International', 'Popeyes'),
  trListCompany('Sbarro LLC', 'Sbarro'),
  trListCompany('Krispy Kreme, Inc.', 'Krispy Kreme'),
]

export const COMPANIES: Company[] = [...TARGET_COMPANIES, ...PRESSURE_COMPANIES, ...TR_LIST_COMPANIES]

export const EXPERT = {
  name: 'Boykot Dedektifi',
  slug: 'boykot-dedektifi',
  title: 'Bağımsız Boykot Araştırma Platformu',
  bio: [
    "Boykot Dedektifi, tüketicilerin bilinçli ve etik seçimler yapabilmesi için kapsamlı bir marka ve ürün veritabanı sunan bağımsız bir boykot değerlendirme platformudur. Markalar boykot gerekçeleriyle birlikte kayıtlıdır; mobil uygulamada barkod taramasıyla rafın önünde sorgulanabilir.",
    "Boykot Dedektifi, bir ürünü üç katmanlı kanıt hiyerarşisiyle inceler: (1) BDS hareketinin yayımladığı resmî hedef listeleri ve sürmekte olan kampanyalar, (2) ürünün işgal altındaki topraklardan gelip gelmediği (GS1 barkod prefix 729), (3) Türkiye'deki tüketici boykot listeleri.",
    "Birinci ve ikinci katman belgelenmiş suç ortaklığına dayanır ve 'Boykotlu' derecesini alır. Üçüncü katman doğrulanmamış tüketici listelerine dayanır; bu yüzden 'Şüpheli' olarak işaretlenir ve 'Boykotlu' ile eşitlenmez.",
    "Her kuralın altında kaynak bağlantıları bulunur. Listeler yaşayan belgelerdir: BDS kampanyaları sona erdiğinde (örneğin Puma, İsrail Futbol Federasyonu sponsorluğunu bitirdi) ilgili kural pasife alınır.",
  ].join('\n\n'),
  socialLinks: {
    website: 'https://boykotdedektifi.com',
    twitter: 'https://x.com/B0YKOTDedektifi',
    instagram: 'https://www.instagram.com/boykotdedektifi',
    youtube: 'https://www.youtube.com/@boykotdedektifi',
  },
  credentials: [
    {
      title: "Dünyanın en büyük boykot platformu — marka ve ürün veritabanı",
      year: 2026,
      issuer: 'Boykot Dedektifi',
    },
    {
      title: 'Google Play uygulaması — 1 Mn+ indirme, 95,1 B değerlendirme',
      year: 2026,
      issuer: 'Google Play',
    },
    {
      title: 'App Store uygulaması — 4,9/5 puan, 33 B değerlendirme',
      year: 2026,
      issuer: 'Apple App Store',
    },
  ],
}

export const TOPIC = {
  name: 'Boykot',
  slug: 'boykot',
  description:
    "Bir ürünün veya markanın İsrail'in işgali, apartheid rejimi ya da Gazze soykırımıyla belgelenmiş bağlantısı. BDS hedef listeleri, menşe ülke (GS1 729) ve tüketici listeleri olmak üzere üç kanıt katmanıyla değerlendirilir.",
  icon: '🛑',
  color: '#dc2626',
  order: 1,
}

export const RATINGS = [
  {
    name: 'Boykotlu',
    color: '#dc2626',
    order: 0,
    description:
      "Belgelenmiş suç ortaklığı: BDS resmî hedef listesi/kampanyası ya da işgal altındaki topraklardan menşe (GS1 729). Ürün doğrudan boykot listesindedir.",
  },
  {
    name: 'Şüpheli',
    color: '#f59e0b',
    order: 1,
    description:
      "Doğrulanmamış bağlantı: BDS'nin 'baskı hedefi' ilan ettiği şirketler veya Türkiye'deki tüketici boykot listelerinde yer alan markalar. Boykot kararı için ek doğrulama gerekir.",
  },
]

const IL_COUNTRY = {
  name: 'İsrail',
  slug: 'israil',
  code: '729',
  iso: 'IL',
}

type SeedSummary = {
  countries: number
  brands: number
  rules: number
}

export type BrandSeedData = {
  name: string
  slug: string
  country: string
  description: string
  isBoycotted: boolean
  boycottReason?: string
}

export type SeedBrand = { name: string; data: BrandSeedData }

export type SeedRule = {
  name: string
  ruleType: ExpertRule['ruleType']
  ratingName: 'Boykotlu' | 'Şüpheli'
  brandName?: string
  countrySlug?: string
  description: string
  sources: SeedSource[]
}

export type SeedPlan = {
  country: typeof IL_COUNTRY
  topic: typeof TOPIC
  expert: typeof EXPERT
  ratings: typeof RATINGS
  brands: SeedBrand[]
  rules: SeedRule[]
}

/**
 * Yerel (Local API) ve uzak (REST) yazıcıların paylaştığı tek veri planı.
 * Marka/kural metinleri yalnızca burada tanımlanır; adaptörler sadece yazar.
 */
export function buildSeedPlan(): SeedPlan {
  const brands: SeedBrand[] = []
  for (const company of COMPANIES) {
    for (const brandName of company.brands) {
      brands.push({ name: brandName, data: buildBrandData(company, brandName) })
    }
  }

  const rules: SeedRule[] = [
    {
      name: 'Marka Boykot Listesinde',
      ruleType: 'brand_boycotted',
      ratingName: 'Boykotlu',
      description: [
        "Bu ürünün markası, işgal veya apartheid ile belgelenmiş bağlantısı nedeniyle 'Boykotlu' olarak işaretlenmiştir.",
        "Kapsam: BDS hareketinin yayımladığı tüketici öncelikli hedefler, BDS'nin desteklediği taban (organik) boykotlar ve sürmekte olan BDS kampanyaları. Marka kaydındaki 'Boykot Gerekçesi' alanı o markaya özel delili içerir.",
        'Marka yeni bir kanıtla listeye eklenirse bu kural otomatik olarak o markanın tüm ürünlerini kapsar.',
      ].join('\n\n'),
      sources: [BDS_GUIDE, BDS_CAMPAIGNS],
    },
    {
      name: 'İsrail Menşeli Ürün (GS1 729)',
      ruleType: 'country',
      ratingName: 'Boykotlu',
      countrySlug: IL_COUNTRY.slug,
      description: [
        "Ürünün menşe ülkesi İsrail olarak belirlendi. GS1 standartlarında 729 barkod prefix'i İsrail'e aittir ve bu prefix ile başlayan barkodlar İsrail kaynaklı ürünleri gösterir.",
        "BDS hareketi, iki koşulu karşılamadığı sürece tüm İsrail şirketlerinin boykot edilmesi çağrısı yapmaktadır: (a) İsrail'in askeri işgali, apartheid veya yerleşimci sömürgeciliğine bulaşmamış olmak, (b) Filistinlilerin uluslararası hukuk kapsamındaki haklarını, öncelikle UN 194 uyarınca mültecilerin geri dönüş hakkını kamuya açık şekilde tanımak. BDS'nin bildirdiğine göre bu koşulları karşılayan bir İsrail şirketi bulunmamaktadır.",
        "Uyarı: Yasadışı yerleşimlerde üretilen ürünler 'Product of Israel' etiketiyle satılabilir; etiket ile üretim yeri farklı olabilir. Bu nedenle menşe kaydı barkod prefix'i ile birlikte değerlendirilmelidir.",
      ].join('\n\n'),
      sources: [
        BDS_GUIDE,
        {
          title: 'GS1 — Ülke/prefiks listesi (729 = İsrail)',
          url: 'https://www.gs1.org/standards/barcodes/application-identifiers',
        },
      ],
    },
  ]

  for (const company of COMPANIES) {
    if (company.tier !== 'supheli') continue
    for (const brandName of company.brands) {
      rules.push({
        name: `${brandName} — ${company.label} (doğrulanmamış bağlantı)`,
        ruleType: 'brand',
        ratingName: 'Şüpheli',
        brandName,
        description: buildRuleDescription(company, brandName),
        sources: company.sources,
      })
    }
  }

  return { country: IL_COUNTRY, topic: TOPIC, expert: EXPERT, ratings: RATINGS, brands, rules }
}

type RuleContext = {
  expertId: number
  topicId: number
  countryId: number
  ratingIdByName: Record<string, number>
  brandIdByName: Record<string, number>
}

export async function seedBoykotDedektifi(
  payload: Payload,
  log: (msg: string) => void = () => {},
): Promise<SeedSummary> {
  const plan = buildSeedPlan()
  const summary: SeedSummary = { countries: 0, brands: 0, rules: 0 }

  // 1) Ülke: İsrail (GS1 prefix 729)
  const countryId = await findId(payload, 'countries', { slug: { equals: plan.country.slug } })
  const country = countryId
    ? await payload.update({ collection: 'countries', id: countryId, data: plan.country })
    : await payload.create({ collection: 'countries', data: plan.country })
  if (!countryId) summary.countries++
  log(`Ülke hazır: ${plan.country.name} (prefix ${plan.country.code})`)

  // 2) Konu
  const topicId = await findId(payload, 'topics', { slug: { equals: plan.topic.slug } })
  const topic = topicId
    ? await payload.update({ collection: 'topics', id: topicId, data: plan.topic })
    : await payload.create({ collection: 'topics', data: plan.topic })
  log(`Konu hazır: ${plan.topic.name}`)

  // 3) Uzman
  const avatarId = await ensureAvatar(payload, log)
  const expertId = await findId(payload, 'experts', { slug: { equals: plan.expert.slug } })
  const expertData = {
    ...plan.expert,
    ...(avatarId ? { avatar: avatarId } : {}),
    verified: true,
    isPublic: true,
  }
  const expert = expertId
    ? await payload.update({ collection: 'experts', id: expertId, data: expertData })
    : await payload.create({ collection: 'experts', data: expertData })
  log(`Uzman hazır: ${plan.expert.name} (/uzmanlar/${plan.expert.slug})`)

  // 4) Derecelendirme ölçeği
  const ratingIdByName: Record<string, number> = {}
  for (const rating of plan.ratings) {
    const existingId = await findId(payload, 'rating-scales', {
      and: [{ expert: { equals: expert.id } }, { name: { equals: rating.name } }],
    })
    const data = { ...rating, expert: expert.id }
    const doc = existingId
      ? await payload.update({ collection: 'rating-scales', id: existingId, data })
      : await payload.create({ collection: 'rating-scales', data })
    ratingIdByName[rating.name] = doc.id
  }
  log(`Derecelendirmeler hazır: ${plan.ratings.map((r) => r.name).join(', ')}`)

  // 5) Markalar
  const brandIdByName: Record<string, number> = {}
  for (const brand of plan.brands) {
    const existingId = await findId(payload, 'brands', { name: { equals: brand.name } })
    const doc = existingId
      ? await payload.update({ collection: 'brands', id: existingId, data: brand.data })
      : await payload.create({ collection: 'brands', data: brand.data })
    brandIdByName[brand.name] = doc.id
    if (!existingId) summary.brands++
  }
  log(`Markalar hazır: ${plan.brands.length} kayıt`)

  // 6) Kurallar (2 genel + marka bazlı "Şüpheli")
  const context: RuleContext = {
    expertId: expert.id,
    topicId: topic.id,
    countryId: country.id,
    ratingIdByName,
    brandIdByName,
  }
  for (const rule of plan.rules) {
    await upsertRule(payload, summary, context, rule)
  }
  log(`Kurallar hazır: ${plan.rules.length} adet (${summary.rules} yeni)`)

  return summary
}

function buildBrandData(company: Company, brandName: string): BrandSeedData {
  const brand = {
    name: brandName,
    slug: slugify(brandName),
    country: company.country,
    description: `${brandName}, ${company.label} bünyesindeki markalardan biridir.`,
    isBoycotted: company.tier === 'boykot',
  }
  if (company.tier !== 'boykot') return brand

  return {
    ...brand,
    boycottReason: `${company.label} ile bağlantılıdır. ${company.summary}\n\nKaynaklar:\n${company.sources
      .map((s) => `- ${s.title}: ${s.url}`)
      .join('\n')}`,
  }
}

function buildRuleDescription(company: Company, brandName: string) {
  return [
    `"${brandName}" markası ${company.label} ile bağlantılı olduğu için bu kural tetiklenir.`,
    company.summary,
    "Bu kayıt 'Şüpheli' derecesini alır: bağlantı henüz doğrulanmamıştır ve 'Boykotlu' ile eşitlenmez. Yeni bir kanıt (BDS kararı, BM veritabanı kaydı veya şirket açıklaması) doğrulanırsa kural 'Boykotlu' derecesine yükseltilir.",
  ].join('\n\n')
}

const ASSET_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'assets')
const AVATAR_FILENAME = 'boykot-dedektifi-icon.webp'
const AVATAR_ALT = 'Boykot Dedektifi logosu'

/** Uzman avatarı: gerçek marka ikonu (192x192 webp) ve medya alt metni. */
export const SEED_AVATAR = {
  filePath: path.join(ASSET_DIR, AVATAR_FILENAME),
  alt: AVATAR_ALT,
}

/**
 * Uzman avatarını gerçek marka ikonundan (seed/assets/boykot-dedektifi-icon.webp)
 * medya koleksiyonuna bir kez yükler; sonraki çalıştırmalarda aynı kaydı kullanır.
 */
async function ensureAvatar(
  payload: Payload,
  log: (msg: string) => void,
): Promise<number | undefined> {
  const existingId = await findId(payload, 'media', { alt: { equals: AVATAR_ALT } })
  if (existingId) return existingId

  const filePath = path.join(ASSET_DIR, AVATAR_FILENAME)
  if (!fs.existsSync(filePath)) {
    log(`Avatar dosyası bulunamadı, alan boş bırakıldı: ${filePath}`)
    return undefined
  }

  const media = await payload.create({
    collection: 'media',
    data: { alt: AVATAR_ALT },
    filePath,
  })
  log(`Avatar yüklendi: ${AVATAR_ALT}`)
  return media.id as number
}

async function findId<TSlug extends CollectionSlug>(
  payload: Payload,
  collection: TSlug,
  where: Where,
): Promise<number | undefined> {
  const result = await payload.find({ collection, where, limit: 1, depth: 0 })
  return result.docs[0]?.id as number | undefined
}

async function upsertRule(
  payload: Payload,
  summary: SeedSummary,
  context: RuleContext,
  rule: SeedRule,
) {
  const existingId = await findId(payload, 'expert-rules', {
    and: [
      { expert: { equals: context.expertId } },
      { topic: { equals: context.topicId } },
      { name: { equals: rule.name } },
    ],
  })
  const ruleData = {
    name: rule.name,
    expert: context.expertId,
    topic: context.topicId,
    rating: context.ratingIdByName[rule.ratingName],
    ruleType: rule.ruleType,
    description: rule.description,
    brand: rule.brandName ? context.brandIdByName[rule.brandName] : undefined,
    country: rule.countrySlug ? context.countryId : undefined,
    isActive: true,
    evidence: rule.sources.map((source) => ({
      type: 'link' as const,
      url: source.url,
      caption: source.title,
    })),
    sources: rule.sources.map((source) => ({ title: source.title, url: source.url })),
  }
  if (existingId) {
    await payload.update({ collection: 'expert-rules', id: existingId, data: ruleData })
  } else {
    await payload.create({ collection: 'expert-rules', data: ruleData })
    summary.rules++
  }
}
