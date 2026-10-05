import { useEffect, useRef, useState } from 'react'
import { Button, EmptyState, Input } from '../components/ui'
import { Icon } from '../components/Icons'
import {
  deletePriceFile,
  downloadPriceFile,
  listPriceFiles,
  savePriceFile,
  type PriceFile,
  type PriceFileCategory,
} from '../db/priceFiles'

const EXCEL_ACCEPT = '.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

export function PriceEstimates() {
  return (
    <div className="price-files">
      <FileSection
        category="price"
        title="Прайс"
        description="Храните прайс-листы в Excel и скачивайте их в любой момент."
      />
      <FileSection
        category="estimate"
        title="Шаблоны смет"
        description="Добавляйте шаблоны смет под разные виды работ в формате Excel."
      />
    </div>
  )
}

function FileSection({
  category,
  title,
  description,
}: {
  category: PriceFileCategory
  title: string
  description: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<PriceFile[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setFiles(await listPriceFiles(category))
      setError(null)
    } catch {
      setError('Не удалось открыть хранилище файлов на этом устройстве.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [category])

  const upload = async (file: File) => {
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.xlsm')) {
      setError('Загрузить можно только Excel-файл: .xlsx, .xls или .xlsm')
      return
    }

    try {
      setBusy(true)
      await savePriceFile(file, category, name)
      setName('')
      setError(null)
      await load()
    } catch {
      setError('Не удалось сохранить файл. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Удалить этот файл?')) return
    try {
      await deletePriceFile(id)
      await load()
    } catch {
      setError('Не удалось удалить файл.')
    }
  }

  return (
    <section className="price-file-section">
      <div className="section-title">{title}</div>
      <div className="field-hint price-file-description">{description}</div>

      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={category === 'price' ? 'Название прайса' : 'Например: Смета — отделка ванной'}
      />

      <input
        ref={inputRef}
        type="file"
        accept={EXCEL_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void upload(file)
        }}
      />

      <Button
        icon="upload"
        full
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Загрузка…' : 'Загрузить Excel-файл'}
      </Button>

      {error && <div className="field-error price-file-error">{error}</div>}

      {loading ? (
        <div className="field-hint">Загрузка файлов…</div>
      ) : files.length === 0 ? (
        <EmptyState
          icon="doc"
          title={category === 'price' ? 'Прайсов пока нет' : 'Шаблонов смет пока нет'}
          description="Загрузите Excel-файл, чтобы он появился здесь."
        />
      ) : (
        <div className="price-file-list">
          {files.map((file) => (
            <div className="price-file-item" key={file.id}>
              <div className="price-file-main">
                <Icon name="doc" size={22} />
                <div>
                  <div className="price-file-name">{file.name}</div>
                  <div className="field-hint">{file.fileName}</div>
                </div>
              </div>
              <div className="price-file-actions">
                <button
                  className="icon-btn"
                  title="Скачать"
                  aria-label="Скачать"
                  onClick={() => downloadPriceFile(file)}
                >
                  <Icon name="download" size={20} />
                </button>
                <button
                  className="icon-btn"
                  title="Удалить"
                  aria-label="Удалить"
                  onClick={() => void remove(file.id)}
                >
                  <Icon name="trash" size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
