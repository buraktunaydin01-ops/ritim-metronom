# Ritim — macOS Monterey (Intel) Metronom

Bu sürüm **macOS 12.7.4 Monterey + Intel x86_64** için düzenlenmiştir.

## Doğru sürümler
- Node.js: **22.23.4 (LTS)** (macOS 12 destekli 22.x serisi).
- Electron: **43.8.7** (macOS 12 destekli son Electron ana sürümü 43).
- macOS 12.7.4 veya daha yeni, x86_64 işlemci.

> Not: Electron 43 için güvenlik desteğinin 5 Ocak 2027'de sona ermesi planlanmaktadır. Bu uygulama sadece yerel dosyalar kullanır, dış bağlantı açmaz, ama eski sürümün uzun vadeli bakım sınırlamalarını göz önünde bulundurun.

## Node.js kurulumunu düzeltme
Node.js 24 ya da daha yeni sürümünü kurduktan sonra terminalde `dyld: Symbol not found` hatası görüyorsanız, [Node.js 22.23.4 için resmi macOS kurulum paketi](https://nodejs.org/dist/v22.23.4/node-v22.23.4.pkg) ile 22 serisini kurun. `.pkg` dosyasını açıp standart kurulumu tamamlayın.

VS Code'u (veya Terminal'i) tamamen kapatıp yeniden açın. Şunları çalıştırın:

```sh
node -v
npm -v
```

`v22.23.4` ve bir npm sürümü görünmelidir. Eğer `dyld` hatası devam ederse `type -a node` ve `type -a npm` çıktılarını kontrol edin; eski bir Node.js PATH'te öne geçmiş olabilir.

## Çalıştırma

Bu klasörü VS Code ile açın, terminalde:

```sh
npm install
npm start
```

Pencere açıldıktan sonra BPM, ölçü ve ses ayarlarını değiştirebilirsiniz. Node.js kurulumunun ardından proje bağımlılıklarının yüklenmesi için **bir kez internet** gereklidir; uygulama normal kullanımda çevrimdışıdır.

## macOS uygulaması oluşturma

```sh
npm run build:mac:intel
```

`dist` klasöründe `.dmg` oluşur. Açıp uygulamayı `/Applications` dizinine sürükleyebilirsiniz. Alternatif olarak, DMG olmadan uygulama klasörü oluşturmak için `npm run build:mac:app` çalıştırabilirsiniz.

Bu sürüm **yalnızca Intel Mac** için ayarlanmıştır; ayrıca ARM hedefi istenirse proje yeniden düzenlenebilir.

## Dosyalar

- `index.html`, `styles.css`: metronom arayüzü.
- `app.js`: Web Audio API ritim ve ses motoru.
- `main.cjs`: Electron macOS uygulama penceresi.
- `package.json`: sürümler ve derleme ayarları.
- `build/icon.icns`: macOS uygulama simgesi.

Uygulama Apple Developer ID ile imzalanmış/noterlenmiş değildir; kendi Mac'inizde ilk açılışta güvenlik uyarısı alabilirsiniz.
