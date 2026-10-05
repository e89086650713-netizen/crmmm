import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, EmptyState, Field, Input, IntegerInput, Modal, Select, Textarea, cx } from '../components/ui'
import { Icon } from '../components/Icons'
import { useData } from '../state/DataContext'
import type { InventoryCategory, Product, ToolType } from '../types'
import { uid } from '../utils/id'
import { useRoute } from '../router'

const CATEGORIES: Array<{ value: InventoryCategory; label: string }> = [
  { value: 'tool', label: 'Инструмент' },
  { value: 'material', label: 'Материалы' },
  { value: 'consumable', label: 'Расходники' },
]

export function Stock() {
  const { db, refresh } = useData()
  const { navigate } = useRoute()
  const [category, setCategory] = useState<InventoryCategory>('tool')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanTarget, setScanTarget] = useState<'search' | 'form'>('search')
  const [scannedCode, setScannedCode] = useState('')

  const products = db.getProducts().filter((p) => (p.inventoryCategory ?? 'material') === category)
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => products.filter((p) => !q || [p.name, p.barcode, p.inventoryNumber, p.sku].some((v) => (v ?? '').toLowerCase().includes(q))),
    [products, q],
  )

  const scanResult = (value: string) => {
    const code = value.trim()
    if (!code) return
    if (scanTarget === 'form') setScannedCode(code)
    else setQuery(code)
    setScanOpen(false)
  }

  return (
    <div>
      <div className="stock-category-tabs" role="tablist" aria-label="Категория склада">
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cx('stock-category-tab', category === item.value && 'stock-category-tab-active')}
            onClick={() => setCategory(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stock-search-row">
        <div className="search stock-search-main">
          <Icon name="search" size={18} />
          <input
            placeholder="Поиск по названию, QR/штрихкоду или инв. номеру"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="secondary" icon="scan" onClick={() => { setScanTarget('search'); setScanOpen(true) }} aria-label="Сканировать код">
          Сканировать
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="warehouse"
          title={q ? 'Ничего не найдено' : 'Склад пуст'}
          description={q ? 'Проверьте код или инвентаризационный номер' : 'Добавьте первую позицию на склад'}
          action={<Button icon="plus" onClick={() => setEditing('new')}>Добавить</Button>}
        />
      ) : (
        <div className="list">
          {filtered.map((p) => (
            <button key={p.id} type="button" className="stock-inventory-card" onClick={() => navigate(`/stock/${p.id}`)}>
              <div className="stock-inventory-photo">
                {p.photoDataUrl ? <img src={p.photoDataUrl} alt="" /> : <Icon name={category === 'tool' ? 'box' : 'warehouse'} size={28} />}
              </div>
              <div className="stock-inventory-main">
                <div className="stock-inventory-title-row">
                  <span className="stock-inventory-title">{p.name}</span>
                  {p.inUse && <Badge tone="red">В использовании</Badge>}
                </div>
                <div className="stock-inventory-sub">
                  Кол-во: {p.stock}
                  {p.inventoryNumber ? ` · Инв. № ${p.inventoryNumber}` : ''}
                </div>
                {p.inUse && p.usedBy && <div className="stock-inventory-use">У кого/где: {p.usedBy}</div>}
                {p.barcode && <div className="stock-inventory-code">Код: {p.barcode}</div>}
              </div>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
      )}

      <div className="stock-bottom-action">
        <Button full icon="plus" onClick={() => setEditing('new')}>Добавить позицию</Button>
      </div>

      {editing && (
        <InventoryForm
          initial={editing === 'new' ? undefined : editing}
          defaultCategory={category}
          onClose={() => setEditing(null)}
          onSave={(product) => {
            db.saveProduct(product)
            refresh()
            setEditing(null)
          }}
          onDelete={editing === 'new' ? undefined : () => {
            if (window.confirm('Удалить позицию со склада?')) {
              db.deleteProduct(editing.id)
              refresh()
              setEditing(null)
            }
          }}
          onScan={() => { setScanTarget('form'); setScannedCode(''); setScanOpen(true) }}
          scanValue={scannedCode}
        />
      )}

      {scanOpen && <BarcodeScanner onClose={() => setScanOpen(false)} onDetected={scanResult} />}
    </div>
  )
}

function InventoryForm({
  initial,
  defaultCategory,
  onClose,
  onSave,
  onDelete,
  onScan,
  scanValue,
}: {
  initial?: Product
  defaultCategory: InventoryCategory
  onClose: () => void
  onSave: (product: Product) => void
  onDelete?: () => void
  onScan: () => void
  scanValue: string
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<InventoryCategory>(initial?.inventoryCategory ?? defaultCategory)
  const [toolType, setToolType] = useState<ToolType>(initial?.toolType ?? 'manual')
  const [photo, setPhoto] = useState(initial?.photoDataUrl ?? '')
  const [barcode, setBarcode] = useState(initial?.barcode ?? '')
  const [qty, setQty] = useState(String(initial?.stock ?? 0))
  const [inventoryNumber, setInventoryNumber] = useState(initial?.inventoryNumber ?? '')
  const [inUse, setInUse] = useState(Boolean(initial?.inUse))
  const [usedBy, setUsedBy] = useState(initial?.usedBy ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scanValue) setBarcode(scanValue)
  }, [scanValue])

  const submit = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? uid(),
      name: name.trim(),
      sku: initial?.sku ?? '',
      price: initial?.price ?? 0,
      cost: initial?.cost ?? 0,
      stock: Math.max(0, Number.parseInt(qty, 10) || 0),
      minStock: initial?.minStock ?? 0,
      description: description.trim(),
      kind: 'product',
      inventoryCategory: category,
      toolType: category === 'tool' ? toolType : undefined,
      photoDataUrl: photo || undefined,
      barcode: barcode.trim() || undefined,
      inventoryNumber: inventoryNumber.trim() || undefined,
      inUse,
      usedBy: inUse ? usedBy.trim() : undefined,
    })
  }

  const onPhoto = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  return (
    <Modal title={initial ? 'Изменить позицию' : 'Новая позиция'} onClose={onClose}>
      <div className="form">
        <Field label="Название предмета *">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Категория">
          <Select value={category} onChange={(e) => setCategory(e.target.value as InventoryCategory)}>
            {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </Field>
        {category === 'tool' && (
          <Field label="Тип инструмента">
            <Select value={toolType} onChange={(e) => setToolType(e.target.value as ToolType)}>
              <option value="manual">Ручной</option>
              <option value="electric">Электрический</option>
            </Select>
          </Field>
        )}
        <Field label="Фото">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => onPhoto(e.target.files?.[0])} />
          {photo && <img className="stock-form-photo" src={photo} alt="Фото предмета" />}
        </Field>
        <Field label="QR-код / штрихкод">
          <div className="stock-code-row">
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Сканируйте или введите вручную" />
            <Button variant="secondary" icon="scan" onClick={onScan}>Сканировать</Button>
          </div>
        </Field>
        <Field label="Количество">
          <IntegerInput value={qty} onChange={setQty} />
        </Field>
        <Field label="Инвентаризационный номер">
          <Input value={inventoryNumber} onChange={(e) => setInventoryNumber(e.target.value)} placeholder="ИНВ-0001" />
        </Field>
        <label className="checkbox-row">
          <input type="checkbox" checked={inUse} onChange={(e) => setInUse(e.target.checked)} />
          <span>В использовании</span>
        </label>
        {inUse && (
          <Field label="У кого или где используется">
            <Input value={usedBy} onChange={(e) => setUsedBy(e.target.value)} placeholder="Иван / объект №3" />
          </Field>
        )}
        <Field label="Описание">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="form-actions">
          {onDelete && <Button variant="danger" icon="trash" onClick={onDelete}>Удалить</Button>}
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button icon="check" onClick={submit}>Сохранить</Button>
        </div>
      </div>
    </Modal>
  )
}

function BarcodeScanner({ onClose, onDetected }: { onClose: () => void; onDetected: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    const start = async () => {
      try {
        if (!('BarcodeDetector' in window)) {
          setError('Автоматическое сканирование не поддерживается этим браузером. Введите код вручную.')
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const Detector = (window as Window & { BarcodeDetector?: {
          new (options?: { formats?: string[] }): { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> }
          getSupportedFormats?: () => Promise<string[]>
        } }).BarcodeDetector
        if (!Detector) return
        const formats = Detector.getSupportedFormats ? await Detector.getSupportedFormats() : undefined
        const detector = formats?.length ? new Detector({ formats }) : new Detector()
        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes[0]?.rawValue) {
              onDetected(codes[0].rawValue)
              return
            }
          } catch { /* камера продолжает работать */ }
          timer = window.setTimeout(tick, 250)
        }
        void tick()
      } catch {
        setError('Не удалось открыть камеру. Проверьте разрешение камеры и HTTPS.')
      }
    }
    void start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetected])

  return (
    <Modal title="Сканировать QR / штрихкод" onClose={onClose}>
      <div className="scanner-box">
        <video ref={videoRef} playsInline muted className="scanner-video" />
        <div className="scanner-frame" />
      </div>
      {error && <div className="field-hint">{error}</div>}
      <Field label="Код вручную">
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Введите код" />
      </Field>
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button onClick={() => manual.trim() && onDetected(manual.trim())}>Использовать код</Button>
      </div>
    </Modal>
  )
}
