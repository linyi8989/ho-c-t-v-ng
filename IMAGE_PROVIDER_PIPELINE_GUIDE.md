# Hướng dẫn xây dựng pipeline tìm kiếm và tải ảnh về hệ thống

> Phiên bản tài liệu: 1.0  
> Ngày đối chiếu API: 14/09/2026  
> Mẫu kỹ thuật: TypeScript + Node.js 20+ + Express  
> Mục tiêu: có thể mang kiến trúc này sang một dự án khác mà không phụ thuộc mã nguồn IOE Master.

## 1. Mục tiêu và phạm vi

Pipeline này giải quyết hai việc khác nhau:

1. **Tìm ảnh** trên Wikimedia Commons, Pixabay hoặc Pexels để người soạn nội dung xem và lựa chọn.
2. **Nhập ảnh vào hệ thống** bằng cách tải tệp về vùng lưu trữ do mình quản lý, lưu metadata nguồn/bản quyền, rồi chỉ dùng URL nội bộ trong câu hỏi.

Luồng chuẩn:

```text
Trình duyệt
  ├─ GET /api/image-library/search?provider=wikimedia&q=apple
  │    └─ Backend gọi API nhà cung cấp và trả kết quả xem trước
  │
  └─ POST /api/image-library/import { provider, externalId }
       ├─ Backend tra lại ảnh bằng externalId
       ├─ Kiểm tra giấy phép và URL nguồn
       ├─ Tải tệp có timeout và giới hạn dung lượng
       ├─ Kiểm tra MIME + magic bytes
       ├─ Tính SHA-256 và loại ảnh trùng
       ├─ Lưu vào local disk hoặc object storage
       ├─ Lưu metadata nguồn/bản quyền vào database
       └─ Trả localUrl cho giao diện
```

Không lưu URL ảnh của nhà cung cấp làm URL sử dụng lâu dài. URL đó chỉ dùng để xem trước và để backend tải tệp ngay khi người dùng chọn ảnh.

## 2. Các nguyên tắc không được bỏ qua

- API key chỉ tồn tại ở backend và biến môi trường; tuyệt đối không dùng biến `VITE_*` hoặc đưa key vào JavaScript phía trình duyệt.
- Client chỉ gửi `provider` và `externalId` khi nhập ảnh. Client không được phép gửi một URL tùy ý cho server tải.
- Backend phải gọi lại API nhà cung cấp để lấy URL tải chính thức tại thời điểm nhập.
- Chỉ cho phép HTTPS và hostname nằm trong allowlist riêng của từng provider.
- Kiểm tra allowlist cả trước và sau redirect để chống SSRF.
- Giới hạn thời gian, dung lượng và loại nội dung trong khi stream; không chờ tải xong mới kiểm tra kích thước.
- Không tin hoàn toàn vào đuôi tệp hoặc `Content-Type`; phải kiểm tra magic bytes.
- Không nhận SVG từ nguồn ngoài trong pipeline này. SVG có thể chứa script hoặc liên kết ngoài và cần quy trình làm sạch riêng.
- Tính SHA-256 để chống lưu cùng một nội dung nhiều lần.
- Lưu tác giả, giấy phép, liên kết giấy phép và trang nguồn cùng media asset.
- Chỉ tài khoản giáo viên/quản trị được tìm và nhập ảnh; route hiển thị ảnh có thể công khai nếu nội dung học tập cần sử dụng công khai.
- “Tải được bằng API” không đồng nghĩa với “được phép sử dụng tùy ý”. Điều khoản và giấy phép phải được kiểm tra lại trước khi phát hành sản phẩm.

## 3. Nhà cung cấp đề xuất

| Provider | Cần API key | Phù hợp | Lưu ý triển khai |
|---|---:|---|---|
| Wikimedia Commons | Không | Ảnh mở, minh họa sự vật, địa danh, khoa học | Giấy phép theo từng tệp; phải giữ attribution và nên dùng allowlist giấy phép |
| Pixabay | Có | Ảnh, illustration, vector preview | Bật `safesearch`; kết quả tìm kiếm phải ghi nguồn; không hotlink lâu dài; cache truy vấn theo điều khoản hiện hành |
| Pexels | Có | Ảnh chụp chất lượng cao | Gửi key trong header `Authorization`; hiển thị liên kết Pexels và ghi công nhiếp ảnh gia khi có thể |

Tài liệu chính thức:

- [Pixabay API documentation](https://pixabay.com/api/docs/)
- [Pexels API documentation](https://www.pexels.com/api/documentation/)
- [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo/en)
- [MediaWiki Search and discovery API](https://www.mediawiki.org/wiki/API:Search_and_discovery)

Các giới hạn, điều khoản và trường response có thể thay đổi. Đọc lại các trang trên trước mỗi lần phát hành lớn.

## 4. Cấu trúc thư mục tối thiểu

```text
src/
  shared/
    imageTypes.ts
  client/
    imageLibraryApi.ts
    ImagePicker.tsx              # nếu dùng React
server/
  images/
    providers/
      imageProvider.ts
      wikimediaProvider.ts
      pixabayProvider.ts
      pexelsProvider.ts
      registry.ts
    managedImageService.ts
    imageLibraryRouter.ts
  media/
    mediaStorage.ts
    localMediaStorage.ts
    mediaRouter.ts
  repositories/
    mediaRepository.ts
data/
  media/
    images/
```

Provider chỉ chịu trách nhiệm giao tiếp với nguồn ngoài. `ManagedImageService` chịu trách nhiệm tải và kiểm định tệp. Storage chỉ chịu trách nhiệm lưu/đọc/xóa. Repository chỉ chịu trách nhiệm metadata. Không trộn bốn trách nhiệm này vào một route.

## 5. Biến môi trường

Tạo `.env.example`, không ghi key thật:

```dotenv
# Pixabay và Pexels là tùy chọn. Wikimedia hoạt động không cần key.
PIXABAY_API_KEY=
PEXELS_API_KEY=

# Wikimedia yêu cầu User-Agent nhận diện ứng dụng; nên dùng email hoặc URL liên hệ thật.
WIKIMEDIA_USER_AGENT=MyEducationApp/1.0 (contact@example.com)

# Thư mục phải nằm trên persistent disk khi chạy production.
MEDIA_STORAGE_PATH=./data/media

IMAGE_PROVIDER_TIMEOUT_MS=20000
MEDIA_DOWNLOAD_TIMEOUT_MS=20000
MEDIA_MAX_IMAGE_BYTES=8388608

# Chỉ dùng khi sinh absolute URL ở backend.
PUBLIC_APP_URL=https://example.com
```

Tại production:

- mount `MEDIA_STORAGE_PATH` vào persistent volume; hoặc thay local storage bằng S3/R2;
- backup cả media và database metadata;
- không lưu media quan trọng trong filesystem tạm của container/serverless.

## 6. Hợp đồng dữ liệu dùng chung

`src/shared/imageTypes.ts`:

```ts
export type ImageProviderId = 'wikimedia' | 'pixabay' | 'pexels';

export interface ImageSearchResult {
  provider: ImageProviderId;
  externalId: string;
  thumbnailUrl: string;
  previewUrl: string;
  title: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourcePageUrl: string;
  width?: number;
  height?: number;
}

export interface ResolvedImage extends ImageSearchResult {
  /** Chỉ được tồn tại trong backend; không trả trường này cho search response. */
  downloadUrl: string;
}

export interface ManagedMediaAsset extends ImageSearchResult {
  id: string;
  localUrl: string;
  relativePath: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  fileSize: number;
  sha256: string;
  downloadedAt: string;
}

export interface ProviderStatus {
  id: ImageProviderId;
  label: string;
  configured: boolean;
  note?: string;
}
```

## 7. Chuẩn hóa adapter provider

`server/images/providers/imageProvider.ts`:

```ts
import type {
  ImageProviderId,
  ImageSearchResult,
  ProviderStatus,
  ResolvedImage
} from '../../../src/shared/imageTypes.js';

export interface ImageProvider {
  readonly id: ImageProviderId;
  status(): ProviderStatus;
  search(query: string, limit: number): Promise<ImageSearchResult[]>;
  resolve(externalId: string): Promise<ResolvedImage>;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = Number(process.env.IMAGE_PROVIDER_TIMEOUT_MS || 20_000)
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(
        `Provider HTTP ${response.status}${retryAfter ? `; retry-after=${retryAfter}` : ''}`
      );
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}
```

Mọi provider phải hỗ trợ hai bước:

- `search`: trả metadata xem trước nhưng không làm lộ `downloadUrl`;
- `resolve`: nhận ID đã chọn, gọi lại provider và trả URL tải đáng tin cậy cho backend.

## 8. Adapter Wikimedia Commons

`server/images/providers/wikimediaProvider.ts`:

```ts
import type { ImageSearchResult, ResolvedImage } from '../../../src/shared/imageTypes.js';
import type { ImageProvider } from './imageProvider.js';
import { clamp, fetchJson } from './imageProvider.js';

const ACCEPTED_LICENSE = /^(CC0|Public domain|CC BY(?:-SA)?(?: \d\.\d)?)/i;

export class WikimediaProvider implements ImageProvider {
  readonly id = 'wikimedia' as const;

  status() {
    return { id: this.id, label: 'Wikimedia Commons', configured: true };
  }

  private plain(value: unknown): string {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async query(params: Record<string, string>): Promise<any> {
    const query = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '1200',
      ...params
    });

    return fetchJson(`https://commons.wikimedia.org/w/api.php?${query}`, {
      headers: {
        'Api-User-Agent': process.env.WIKIMEDIA_USER_AGENT ||
          'MyEducationApp/1.0 (contact@example.com)'
      }
    });
  }

  private map(page: any): ResolvedImage | null {
    const info = page?.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const license = this.plain(
      meta.LicenseShortName?.value || meta.UsageTerms?.value
    );

    if (!info?.url || !info?.descriptionurl || !ACCEPTED_LICENSE.test(license)) {
      return null;
    }

    // Dùng thumbnail đã scale để tránh tải ảnh gốc quá lớn.
    const downloadUrl = info.thumburl || info.url;

    return {
      provider: this.id,
      externalId: String(page.pageid),
      thumbnailUrl: info.thumburl || info.url,
      previewUrl: info.thumburl || info.url,
      downloadUrl,
      title: this.plain(meta.ObjectName?.value || page.title?.replace(/^File:/, '')),
      author: this.plain(meta.Artist?.value || 'Wikimedia contributor'),
      license,
      licenseUrl: meta.LicenseUrl?.value || info.descriptionurl,
      sourcePageUrl: info.descriptionurl,
      width: Number(info.width) || undefined,
      height: Number(info.height) || undefined
    };
  }

  async search(query: string, limit: number): Promise<ImageSearchResult[]> {
    const data = await this.query({
      generator: 'search',
      gsrsearch: query.trim(),
      gsrnamespace: '6',
      gsrwhat: 'text',
      gsrlimit: String(clamp(limit, 1, 30))
    });

    return (data.query?.pages || [])
      .map((page: any) => this.map(page))
      .filter(Boolean) as ResolvedImage[];
  }

  async resolve(externalId: string): Promise<ResolvedImage> {
    if (!/^\d+$/.test(externalId)) throw new Error('Invalid Wikimedia page id');
    const data = await this.query({ pageids: externalId });
    const item = this.map(data.query?.pages?.[0]);
    if (!item) throw new Error('Image missing or license is not accepted');
    return item;
  }
}
```

`ACCEPTED_LICENSE` phải được điều chỉnh theo chính sách nội dung của sản phẩm. Với sản phẩm thương mại, không tự động nhận ảnh có hạn chế `NonCommercial` nếu chưa được bộ phận phụ trách quyền sử dụng phê duyệt.

## 9. Adapter Pixabay

`server/images/providers/pixabayProvider.ts`:

```ts
import type { ImageSearchResult, ResolvedImage } from '../../../src/shared/imageTypes.js';
import type { ImageProvider } from './imageProvider.js';
import { clamp, fetchJson } from './imageProvider.js';

export class PixabayProvider implements ImageProvider {
  readonly id = 'pixabay' as const;

  status() {
    return {
      id: this.id,
      label: 'Pixabay',
      configured: Boolean(process.env.PIXABAY_API_KEY)
    };
  }

  private async request(params: URLSearchParams): Promise<any> {
    const key = process.env.PIXABAY_API_KEY;
    if (!key) throw new Error('PIXABAY_API_KEY is not configured');
    params.set('key', key);
    return fetchJson(`https://pixabay.com/api/?${params}`, {
      headers: { Accept: 'application/json' }
    });
  }

  private map(hit: any): ResolvedImage {
    return {
      provider: this.id,
      externalId: String(hit.id),
      thumbnailUrl: hit.previewURL,
      previewUrl: hit.webformatURL,
      downloadUrl: hit.largeImageURL || hit.webformatURL,
      title: String(hit.tags || 'Pixabay image'),
      author: String(hit.user || 'Pixabay contributor'),
      license: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      sourcePageUrl: hit.pageURL,
      width: Number(hit.imageWidth) || undefined,
      height: Number(hit.imageHeight) || undefined
    };
  }

  async search(query: string, limit: number): Promise<ImageSearchResult[]> {
    const data = await this.request(new URLSearchParams({
      q: query.trim().slice(0, 100),
      lang: 'en',
      image_type: 'all',
      safesearch: 'true',
      per_page: String(clamp(limit, 3, 50))
    }));
    return (data.hits || []).map((hit: any) => this.map(hit));
  }

  async resolve(externalId: string): Promise<ResolvedImage> {
    if (!/^\d+$/.test(externalId)) throw new Error('Invalid Pixabay image id');
    const data = await this.request(new URLSearchParams({ id: externalId }));
    if (!data.hits?.[0]) throw new Error('Pixabay image not found');
    return this.map(data.hits[0]);
  }
}
```

Cache kết quả tìm kiếm Pixabay theo điều khoản hiện hành. Không biến chức năng này thành crawler hoặc tải hàng loạt tự động.

## 10. Adapter Pexels

`server/images/providers/pexelsProvider.ts`:

```ts
import type { ImageSearchResult, ResolvedImage } from '../../../src/shared/imageTypes.js';
import type { ImageProvider } from './imageProvider.js';
import { clamp, fetchJson } from './imageProvider.js';

export class PexelsProvider implements ImageProvider {
  readonly id = 'pexels' as const;

  status() {
    return {
      id: this.id,
      label: 'Pexels',
      configured: Boolean(process.env.PEXELS_API_KEY)
    };
  }

  private headers(): Record<string, string> {
    const key = process.env.PEXELS_API_KEY;
    if (!key) throw new Error('PEXELS_API_KEY is not configured');
    return { Authorization: key };
  }

  private map(photo: any): ResolvedImage {
    return {
      provider: this.id,
      externalId: String(photo.id),
      thumbnailUrl: photo.src?.tiny,
      previewUrl: photo.src?.medium,
      downloadUrl: photo.src?.large2x || photo.src?.large || photo.src?.original,
      title: photo.alt || 'Pexels photo',
      author: photo.photographer || 'Pexels contributor',
      license: 'Pexels License',
      licenseUrl: 'https://www.pexels.com/license/',
      sourcePageUrl: photo.url || photo.photographer_url,
      width: Number(photo.width) || undefined,
      height: Number(photo.height) || undefined
    };
  }

  async search(query: string, limit: number): Promise<ImageSearchResult[]> {
    const params = new URLSearchParams({
      query: query.trim(),
      per_page: String(clamp(limit, 1, 50)),
      locale: 'en-US'
    });
    const data = await fetchJson<any>(
      `https://api.pexels.com/v1/search?${params}`,
      { headers: this.headers() }
    );
    return (data.photos || []).map((photo: any) => this.map(photo));
  }

  async resolve(externalId: string): Promise<ResolvedImage> {
    if (!/^\d+$/.test(externalId)) throw new Error('Invalid Pexels photo id');
    const photo = await fetchJson<any>(
      `https://api.pexels.com/v1/photos/${externalId}`,
      { headers: this.headers() }
    );
    return this.map(photo);
  }
}
```

## 11. Registry và allowlist hostname

`server/images/providers/registry.ts`:

```ts
import type { ImageProviderId, ImageSearchResult, ResolvedImage } from '../../../src/shared/imageTypes.js';
import type { ImageProvider } from './imageProvider.js';
import { WikimediaProvider } from './wikimediaProvider.js';
import { PixabayProvider } from './pixabayProvider.js';
import { PexelsProvider } from './pexelsProvider.js';

const ALLOWED_HOSTS: Record<ImageProviderId, readonly string[]> = {
  wikimedia: ['upload.wikimedia.org', 'thumb.wikimedia.org'],
  pixabay: ['pixabay.com', 'cdn.pixabay.com'],
  pexels: ['images.pexels.com']
};

export function isAllowedImageUrl(provider: ImageProviderId, rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_HOSTS[provider].some(
      host => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

export class ImageProviderRegistry {
  private readonly providers = new Map<ImageProviderId, ImageProvider>([
    ['wikimedia', new WikimediaProvider()],
    ['pixabay', new PixabayProvider()],
    ['pexels', new PexelsProvider()]
  ]);

  private get(id: string): ImageProvider {
    const provider = this.providers.get(id as ImageProviderId);
    if (!provider) throw new Error(`Unsupported image provider: ${id}`);
    return provider;
  }

  statuses() {
    return [...this.providers.values()].map(provider => provider.status());
  }

  async search(providerId: string, query: string, limit = 12): Promise<ImageSearchResult[]> {
    const results = await this.get(providerId).search(query, limit);
    // Phòng thủ thêm: không bao giờ trả downloadUrl cho client.
    return results.map(item => {
      const { downloadUrl: _private, ...publicItem } = item as ResolvedImage;
      return publicItem;
    });
  }

  resolve(providerId: string, externalId: string): Promise<ResolvedImage> {
    return this.get(providerId).resolve(externalId);
  }
}
```

Không dùng kiểm tra hostname kiểu `hostname.includes('pixabay.com')`; chuỗi `pixabay.com.attacker.net` sẽ vượt qua kiểu kiểm tra đó. So khớp chính xác hoặc subdomain bằng dấu chấm như ví dụ trên.

## 12. Storage độc lập

`server/media/mediaStorage.ts`:

```ts
export interface SavedMedia {
  id: string;
  storedName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  relativePath: string;
  url: string;
}

export interface MediaStorage {
  saveImage(buffer: Buffer, originalName: string, mimeType: string): Promise<SavedMedia>;
  getImagePath(storedName: string): string | null;
  deleteImage(storedName: string): Promise<boolean>;
}
```

`server/media/localMediaStorage.ts`:

```ts
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MediaStorage, SavedMedia } from './mediaStorage.js';

const EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

export class LocalMediaStorage implements MediaStorage {
  private readonly imagesDir: string;

  constructor(baseDir = process.env.MEDIA_STORAGE_PATH || path.join(process.cwd(), 'data', 'media')) {
    this.imagesDir = path.resolve(baseDir, 'images');
    fs.mkdirSync(this.imagesDir, { recursive: true });
  }

  async saveImage(buffer: Buffer, originalName: string, mimeType: string): Promise<SavedMedia> {
    const ext = EXTENSION[mimeType];
    if (!ext) throw new Error('Unsupported image MIME type');

    const random = crypto.randomBytes(16).toString('hex');
    const storedName = `img_${Date.now()}_${random}${ext}`;
    const target = path.resolve(this.imagesDir, storedName);

    if (!target.startsWith(this.imagesDir + path.sep)) {
      throw new Error('Unsafe media path');
    }

    await fs.promises.writeFile(target, buffer, { flag: 'wx' });

    return {
      id: `media-${random.slice(0, 12)}`,
      storedName,
      fileName: path.basename(originalName).slice(0, 150),
      mimeType,
      fileSize: buffer.length,
      relativePath: `images/${storedName}`,
      url: `/api/media/images/${storedName}`
    };
  }

  getImagePath(storedName: string): string | null {
    const safeName = path.basename(storedName);
    if (safeName !== storedName) return null;
    const target = path.resolve(this.imagesDir, safeName);
    return target.startsWith(this.imagesDir + path.sep) ? target : null;
  }

  async deleteImage(storedName: string): Promise<boolean> {
    const target = this.getImagePath(storedName);
    if (!target) return false;
    try {
      await fs.promises.unlink(target);
      return true;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }
}
```

Trong hệ thống nhiều instance, thay class này bằng `S3MediaStorage` hoặc `R2MediaStorage` nhưng giữ nguyên interface. `saveImage` khi đó upload object với key ngẫu nhiên và trả URL do ứng dụng/CDN kiểm soát.

## 13. Database và repository

Schema SQL tối thiểu:

```sql
CREATE TABLE media_assets (
  id                 VARCHAR(64) PRIMARY KEY,
  provider           VARCHAR(32) NOT NULL,
  external_id        VARCHAR(255) NOT NULL,
  title              TEXT NOT NULL,
  author             TEXT NOT NULL,
  license            TEXT NOT NULL,
  license_url        TEXT NULL,
  source_page_url    TEXT NOT NULL,
  local_url          TEXT NOT NULL,
  relative_path      TEXT NOT NULL,
  mime_type          VARCHAR(64) NOT NULL,
  file_size          BIGINT NOT NULL,
  sha256             CHAR(64) NOT NULL,
  width              INTEGER NULL,
  height             INTEGER NULL,
  downloaded_at      TIMESTAMP NOT NULL,
  created_by         VARCHAR(128) NULL,
  UNIQUE(provider, external_id),
  UNIQUE(sha256)
);

CREATE INDEX media_assets_downloaded_at_idx
  ON media_assets(downloaded_at DESC);
```

Repository cần các hàm:

```ts
export interface MediaRepository {
  findByProviderId(provider: string, externalId: string): Promise<ManagedMediaAsset | null>;
  findBySha256(sha256: string): Promise<ManagedMediaAsset | null>;
  insert(asset: ManagedMediaAsset, createdBy?: string): Promise<ManagedMediaAsset>;
  list(limit: number, offset: number): Promise<ManagedMediaAsset[]>;
}
```

Khi có nhiều request nhập cùng một ảnh, unique constraint là lớp bảo vệ cuối. Nếu insert bị conflict, đọc và trả record đã tồn tại thay vì báo lỗi cho người dùng.

## 14. Dịch vụ tải và quản lý ảnh

Đây là lớp quan trọng nhất. Nó không nhận URL từ client.

`server/images/managedImageService.ts`:

```ts
import crypto from 'node:crypto';
import type { ImageProviderId, ManagedMediaAsset } from '../../src/shared/imageTypes.js';
import type { MediaRepository } from '../repositories/mediaRepository.js';
import type { MediaStorage } from '../media/mediaStorage.js';
import { ImageProviderRegistry, isAllowedImageUrl } from './providers/registry.js';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

function matchesMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  if (mime === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mime === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/gif') return buffer.subarray(0, 3).toString() === 'GIF';
  if (mime === 'image/webp') {
    return buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP';
  }
  return false;
}

export class ManagedImageService {
  constructor(
    private readonly providers: ImageProviderRegistry,
    private readonly storage: MediaStorage,
    private readonly repository: MediaRepository
  ) {}

  async import(
    provider: ImageProviderId,
    externalId: string,
    createdBy?: string
  ): Promise<ManagedMediaAsset> {
    const existing = await this.repository.findByProviderId(provider, externalId);
    if (existing) return existing;

    // Resolve lại từ server; không dùng URL do browser cung cấp.
    const source = await this.providers.resolve(provider, externalId);
    if (!isAllowedImageUrl(provider, source.downloadUrl)) {
      throw new Error('Source host is not allowed');
    }

    const { buffer, mimeType } = await this.download(source.downloadUrl, provider);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const duplicate = await this.repository.findBySha256(sha256);
    if (duplicate) return duplicate;

    const extension: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };
    const saved = await this.storage.saveImage(
      buffer,
      `${provider}-${externalId}${extension[mimeType]}`,
      mimeType
    );

    const { downloadUrl: _private, ...metadata } = source;
    const asset: ManagedMediaAsset = {
      ...metadata,
      id: saved.id,
      localUrl: saved.url,
      relativePath: saved.relativePath,
      mimeType: mimeType as ManagedMediaAsset['mimeType'],
      fileSize: saved.fileSize,
      sha256,
      downloadedAt: new Date().toISOString()
    };

    try {
      return await this.repository.insert(asset, createdBy);
    } catch (error) {
      // Nếu database insert thất bại, nên xóa file vừa tạo để tránh file mồ côi.
      await this.storage.deleteImage(saved.storedName).catch(() => undefined);
      throw error;
    }
  }

  private async download(
    url: string,
    provider: ImageProviderId
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const timeoutMs = Number(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS || 20_000);
    const configuredMax = Number(process.env.MEDIA_MAX_IMAGE_BYTES || 8 * 1024 * 1024);
    const maxBytes = Math.max(100_000, Math.min(configuredMax, 10 * 1024 * 1024));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' }
      });

      if (!response.ok || !response.body) {
        throw new Error(`Image download failed: HTTP ${response.status}`);
      }
      if (!isAllowedImageUrl(provider, response.url)) {
        throw new Error('Redirect target host is not allowed');
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength && contentLength > maxBytes) {
        throw new Error('Image exceeds maximum size');
      }

      const mimeType = String(response.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_MIME.has(mimeType)) {
        throw new Error(`Unsupported content type: ${mimeType || 'unknown'}`);
      }

      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let size = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error('Image exceeds maximum size');
        }
        chunks.push(Buffer.from(value));
      }

      const buffer = Buffer.concat(chunks);
      if (!matchesMagicBytes(buffer, mimeType)) {
        throw new Error('File signature does not match content type');
      }
      return { buffer, mimeType };
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('Image download timed out');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
```

Nâng cấp nên có cho production lớn:

- decode ảnh bằng `sharp`, bỏ metadata EXIF/GPS và encode lại JPEG/WebP;
- giới hạn cả số pixel để chặn decompression bomb;
- quét malware nếu tổ chức yêu cầu;
- ghi audit log cho người nhập, provider, external ID và hash;
- hàng đợi nền nếu tải/resize có thể vượt thời gian request;
- circuit breaker và retry có jitter cho lỗi `429`, `502`, `503`; không retry lỗi dữ liệu `4xx` khác.

## 15. API backend

`server/images/imageLibraryRouter.ts`:

```ts
import { Router } from 'express';
import type { ImageProviderId } from '../../src/shared/imageTypes.js';
import type { ImageProviderRegistry } from './providers/registry.js';
import type { ManagedImageService } from './managedImageService.js';

const PROVIDERS = new Set(['wikimedia', 'pixabay', 'pexels']);

export function createImageLibraryRouter(
  registry: ImageProviderRegistry,
  managedImages: ManagedImageService,
  requireStaff: any
) {
  const router = Router();

  router.get('/providers', requireStaff, (_req, res) => {
    res.json({ items: registry.statuses() });
  });

  router.get('/search', requireStaff, async (req, res) => {
    try {
      const provider = String(req.query.provider || 'wikimedia');
      const query = String(req.query.q || '').trim();
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 12, 30));

      if (!PROVIDERS.has(provider)) {
        return res.status(400).json({ error: 'INVALID_PROVIDER' });
      }
      if (!query || query.length > 100) {
        return res.status(400).json({ error: 'INVALID_QUERY' });
      }

      const items = await registry.search(provider, query, limit);
      return res.json({ items });
    } catch (error: any) {
      return res.status(502).json({
        error: 'IMAGE_SEARCH_FAILED',
        message: error.message
      });
    }
  });

  router.post('/import', requireStaff, async (req: any, res) => {
    try {
      const provider = String(req.body?.provider || '') as ImageProviderId;
      const externalId = String(req.body?.externalId || '');

      if (!PROVIDERS.has(provider) || !/^\d+$/.test(externalId)) {
        return res.status(400).json({ error: 'INVALID_IMAGE_REFERENCE' });
      }

      const item = await managedImages.import(provider, externalId, req.user?.id);
      return res.json({ success: true, item });
    } catch (error: any) {
      return res.status(400).json({
        error: 'IMAGE_IMPORT_FAILED',
        message: error.message
      });
    }
  });

  return router;
}
```

Lắp route:

```ts
const storage = new LocalMediaStorage();
const registry = new ImageProviderRegistry();
const managedImages = new ManagedImageService(registry, storage, mediaRepository);

app.use(
  '/api/image-library',
  createImageLibraryRouter(registry, managedImages, requireStaff)
);
```

Nên áp rate limit riêng:

- search: theo user và provider, ví dụ 30 request/phút;
- import: theo user, ví dụ 10 request/phút;
- cache search bằng khóa `provider + query + page + filters`;
- nếu provider trả `429`, đọc `Retry-After` và trả thông báo chờ rõ ràng cho giao diện.

## 16. Route phục vụ file local

```ts
import fs from 'node:fs';
import { Router } from 'express';
import type { MediaStorage } from './mediaStorage.js';

export function createMediaRouter(storage: MediaStorage) {
  const router = Router();

  router.get('/images/:filename', (req, res) => {
    const filePath = storage.getImagePath(req.params.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'FILE_NOT_FOUND' });
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  });

  return router;
}

app.use('/api/media', createMediaRouter(storage));
```

Tên file là ngẫu nhiên/bất biến nên có thể cache lâu. Nếu cho phép thay nội dung mà giữ nguyên tên thì không được dùng `immutable`.

## 17. Client API

`src/client/imageLibraryApi.ts`:

```ts
import type {
  ImageProviderId,
  ImageSearchResult,
  ManagedMediaAsset
} from '../shared/imageTypes.js';

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
  return data as T;
}

export async function searchImages(
  provider: ImageProviderId,
  query: string
): Promise<ImageSearchResult[]> {
  const params = new URLSearchParams({ provider, q: query, limit: '12' });
  const response = await fetch(`/api/image-library/search?${params}`, {
    credentials: 'include'
  });
  const data = await readJson<{ items: ImageSearchResult[] }>(response);
  return data.items;
}

export async function importImage(
  provider: ImageProviderId,
  externalId: string
): Promise<ManagedMediaAsset> {
  const response = await fetch('/api/image-library/import', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, externalId })
  });
  const data = await readJson<{ item: ManagedMediaAsset }>(response);
  return data.item;
}
```

Giao diện nên có các trạng thái riêng:

- chưa cấu hình key;
- đang tìm;
- không có kết quả;
- provider giới hạn request/`429`;
- đang tải về;
- đã lưu nội bộ;
- ảnh đã tồn tại và được tái sử dụng;
- ảnh bị từ chối do giấy phép, host, kích thước hoặc định dạng.

Trên mỗi card kết quả cần hiển thị ảnh xem trước, tiêu đề, tác giả, giấy phép, liên kết trang nguồn và nút **Lưu vào hệ thống**. Chỉ sau khi import thành công mới cho phép nút **Gắn vào câu hỏi**.

## 18. Gắn ảnh vào câu hỏi/nội dung

Không chỉ lưu `imageUrl`. Nên lưu cả ID asset và snapshot attribution:

```ts
export interface MediaAttribution {
  mediaAssetId: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourcePageUrl: string;
}

export interface QuestionWithImage {
  id: string;
  prompt: string;
  imageUrl?: string;
  mediaAssetIds?: string[];
  mediaAttributions?: MediaAttribution[];
}
```

Khi người soạn chọn asset:

```ts
await updateQuestion(questionId, {
  imageUrl: asset.localUrl,
  mediaAssetIds: [...new Set([...(question.mediaAssetIds || []), asset.id])],
  mediaAttributions: [
    ...(question.mediaAttributions || []).filter(x => x.mediaAssetId !== asset.id),
    {
      mediaAssetId: asset.id,
      author: asset.author,
      license: asset.license,
      licenseUrl: asset.licenseUrl,
      sourcePageUrl: asset.sourcePageUrl
    }
  ]
});
```

Việc giữ snapshot attribution giúp truy vết ngay cả khi metadata tại provider thay đổi. Có thể chạy job định kỳ để phát hiện trang nguồn hoặc giấy phép đã thay đổi, nhưng không tự động ghi đè snapshot lịch sử.

## 19. Upload ảnh từ máy người dùng

Upload thủ công là một luồng khác với import provider:

```http
POST /api/media/upload
Content-Type: multipart/form-data

file=<binary>
category=images
```

Áp dụng cùng các kiểm tra MIME, magic bytes, kích thước, SHA-256 và quyền truy cập. Ngoài ra cần trường:

- `rightsConfirmed: true`;
- nguồn/tác giả nếu không phải ảnh tự tạo;
- người upload và thời điểm upload.

Không khuyến khích base64 JSON cho tệp thông thường vì tăng kích thước request và bộ nhớ. Dùng multipart hoặc presigned upload khi lưu object storage.

## 20. Test bắt buộc

### Unit test

- provider không cấu hình key trả lỗi rõ ràng;
- `externalId` không phải số bị từ chối;
- search response không chứa `downloadUrl`;
- chỉ nhận HTTPS;
- chặn `pixabay.com.attacker.net`;
- chặn `127.0.0.1`, `localhost`, IP private và URL không thuộc allowlist;
- chặn redirect ra ngoài allowlist;
- chặn MIME không hỗ trợ;
- chặn magic bytes giả;
- chặn vượt dung lượng kể cả không có `Content-Length`;
- timeout được chuyển thành lỗi dễ hiểu;
- cùng `provider + externalId` không tải lần hai;
- hai external ID có cùng SHA-256 chỉ lưu một tệp;
- database lỗi sau khi lưu file thì file mới được dọn;
- filename traversal như `../../a.jpg` bị từ chối;
- route media trả `404` khi tệp không tồn tại.

Ví dụ test allowlist bằng Node test runner:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedImageUrl } from '../server/images/providers/registry.js';

test('accepts official Wikimedia CDN', () => {
  assert.equal(
    isAllowedImageUrl('wikimedia', 'https://upload.wikimedia.org/a/b/example.jpg'),
    true
  );
});

test('rejects hostname suffix attack', () => {
  assert.equal(
    isAllowedImageUrl('pixabay', 'https://pixabay.com.attacker.net/image.jpg'),
    false
  );
});
```

### Integration test

Mock provider API và image response để test ổn định. Chỉ giữ một smoke test tùy chọn gọi mạng thật, vì quota và dữ liệu ngoài có thể thay đổi.

Kịch bản end-to-end:

1. Tìm `pencil` bằng Wikimedia.
2. Chọn một kết quả có giấy phép được chấp nhận.
3. Import bằng `provider + externalId`.
4. Xác nhận response có `localUrl`, `sha256`, attribution.
5. GET `localUrl` trả HTTP 200 và đúng `Content-Type`.
6. Tắt mạng ngoài rồi tải lại `localUrl`; ảnh vẫn hiển thị.
7. Import lại cùng ảnh; số file và số record không tăng.

## 21. Checklist triển khai sang dự án khác

### Backend

- [ ] Tạo type dùng chung.
- [ ] Tạo interface provider và helper `fetchJson` có timeout.
- [ ] Cài Wikimedia trước để có luồng không cần key.
- [ ] Thêm Pixabay và Pexels nếu đã có key.
- [ ] Tạo registry và allowlist hostname.
- [ ] Tạo `MediaStorage`; triển khai local hoặc object storage.
- [ ] Tạo bảng `media_assets` và unique index.
- [ ] Tạo `ManagedImageService` với stream limit, MIME, magic bytes và SHA-256.
- [ ] Tạo search/import/assets routes.
- [ ] Bảo vệ route bằng role và rate limit.
- [ ] Tạo route/CDN phục vụ URL nội bộ.
- [ ] Ghi audit log.

### Frontend

- [ ] Chọn provider và nhập từ khóa.
- [ ] Hiển thị attribution ngay trong kết quả.
- [ ] Phân biệt **xem trước** và **đã lưu nội bộ**.
- [ ] Chỉ gắn ảnh sau khi import thành công.
- [ ] Hiển thị lỗi timeout, quota, giấy phép và định dạng.
- [ ] Lưu asset ID cùng nội dung nghiệp vụ.

### Production

- [ ] API key nằm trong secret manager/biến môi trường server.
- [ ] Media nằm trên persistent storage.
- [ ] HTTPS được bật.
- [ ] CORS không mở rộng không cần thiết.
- [ ] Backup database và object/media.
- [ ] Theo dõi `429`, thời gian tải, tỷ lệ lỗi, dung lượng và file mồ côi.
- [ ] Đọc lại điều khoản từng provider trước phát hành.
- [ ] Chạy đủ test bảo mật và end-to-end.

## 22. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Search trả 503 | Thiếu API key | Kiểm tra biến môi trường backend và restart process |
| Search trả 429 | Vượt quota hoặc gửi truy vấn quá dày | Cache, debounce, đọc `Retry-After`, giảm concurrency |
| Preview có nhưng import lỗi | URL resolve/redirect ra host khác, MIME sai hoặc ảnh quá lớn | Log reason; cập nhật allowlist chỉ khi host đó được tài liệu chính thức xác nhận |
| Ảnh chạy local nhưng mất sau deploy | Lưu vào filesystem tạm của container | Dùng persistent volume hoặc S3/R2 |
| Ảnh trùng xuất hiện nhiều bản | Không unique theo provider ID và SHA-256 | Thêm hai unique constraint và xử lý conflict |
| Ảnh tải về nhưng không hiện | Route media sai prefix hoặc reverse proxy không chuyển tiếp | Kiểm tra `localUrl`, mount route và base URL |
| API key lộ trong DevTools | Client gọi provider trực tiếp | Chuyển mọi lời gọi provider sang backend |
| Giấy phép không rõ | Chỉ lưu URL ảnh, bỏ metadata | Bắt buộc lưu attribution và đưa item vào hàng chờ duyệt |

## 23. Ánh xạ với dự án IOE Master hiện tại

Nếu cần đối chiếu bản triển khai đang chạy trong dự án này:

| Thành phần | File hiện tại |
|---|---|
| Type provider/search/managed asset | `src/shared/types/questionFactory.ts` |
| Attribution gắn với câu hỏi | `src/shared/types/ioe.ts` |
| Ba provider, registry, allowlist và downloader | `server/integrations/images/imageProvider.ts` |
| Local media storage | `server/media/mediaStorage.ts` |
| Route phục vụ/upload media | `server/media/mediaRouter.ts` |
| Search/import/assets API | `server/modules/question-factory/questionFactoryRouter.ts` |
| Client API | `src/services/api.ts` |
| Giao diện tìm, lưu, gắn ảnh | `src/components/question-factory/ProviderPipelinePanel.tsx` |
| Test pipeline | `test/questionFactoryPipeline.test.ts` |

Khi port sang dự án khác, nên giữ hợp đồng dữ liệu và ranh giới các lớp, nhưng thay repository, auth, UI và storage driver theo stack của dự án đích. Không sao chép API key, đường dẫn production hard-code hoặc file dữ liệu môi trường cũ.

## 24. Tiêu chí hoàn thành

Tính năng được coi là hoàn chỉnh khi:

1. Có thể tìm ảnh ít nhất bằng Wikimedia khi không cấu hình key.
2. Kết quả search có attribution nhưng không làm lộ URL tải nội bộ của provider.
3. Import chỉ nhận provider và external ID.
4. Ảnh được kiểm định, tải về storage do ứng dụng quản lý và có SHA-256.
5. Tắt kết nối tới provider vẫn hiển thị được ảnh đã nhập.
6. Nhập lại không sinh file trùng.
7. Câu hỏi/nội dung giữ cả `localUrl`, media asset ID và attribution.
8. Server restart/deploy không làm mất ảnh.
9. Test SSRF, MIME giả, file quá lớn, timeout và path traversal đều vượt qua.
10. Điều khoản sử dụng và cách ghi nguồn đã được kiểm tra trước khi phát hành.

