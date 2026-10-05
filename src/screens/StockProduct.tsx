import { useState } from 'react'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Textarea } from '../components/ui'
import { useRoute } from '../router'
import { useData } from '../state/DataContext'
import { isService, type Product } from '../types'
import { money } from '../utils/format'

export function StockProduct({ id }: { id: string }) {
  const { db, refresh } = useData()
  const { navigate } = useRoute()
  const product = db.getProduct(id)
  const [transferOpen, setTransferOpen] = useState(false)

  if (!product || isService(product)) {
    return (
      <EmptyState
        icon="warehouse"
        title="Позиция не найдена"
        description="Позиция удалена или это услуга — услуги на складе не учитываются"
        action={<Button onClick={() => navigate('/stock')}>К складу</Button>}
      />
    )
  }

  const history = [...(product.transferHistory ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

  const returnItem = () => {
    if (!window.confirm('Вернуть позицию из использования?')) return
    db.returnProduct(product.id)
    refresh()
  }

  return (
    <div className="stock-product-detail">
      <Card className="stock-detail-hero">
        <div className="stock-detail-photo">
          {product.photoDataUrl ? <img src={product.photoDataUrl} alt={product.name} /> : <div className="stock-detail-photo-empty">Фото нет</div>}
        </div>
        <div className="stock-detail-title-block">
          <div className="stock-detail-title-row">
            <h2 style={{ margin: 0 }}>{product.name}</h2>
            {product.inUse && <Badge tone="red">В использовании</Badge>}
          </div>
          <div className="stock-detail-meta">{categoryLabel(product)} · Кол-во: {product.stock}</div>
          {product.inUse && product.usedBy && <div className="stock-detail-use">У кого/где: {product.usedBy}</div>}
        </div>
      </Card>

      <Card className="detail-block">
        <h3 className="stock-detail-section-title">Идентификация</h3>
        <DetailRow label="QR / штрихкод" value={product.barcode || '—'} />
        <DetailRow label="Инвентарный номер" value={product.inventoryNumber || '—'} />
        {product.sku && <DetailRow label="Артикул" value={product.sku} />}
        {product.toolType && <DetailRow label="Тип инструмента" value={product.toolType === 'electric' ? 'Электрический' : 'Ручной'} />}
      </Card>

      <Card className="detail-block">
        <div className="stock-detail-actions">
          {product.inUse ? (
            <Button variant="secondary" onClick={returnItem}>Вернуть</Button>
          ) : (
            <Button onClick={() => setTransferOpen(true)}>Передать</Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/stock')}>К складу</Button>
        </div>
      </Card>

      <Card className="detail-block">
        <h3 className="stock-detail-section-title">История передачи</h3>
        {history.length === 0 ? (
          <div className="stock-history-empty">Передач этой позиции пока не было.</div>
        ) : (
          <div className="stock-transfer-history">
            {history.map((entry) => (
              <div className="stock-transfer-entry" key={entry.id}>
                <div className="stock-transfer-entry-head">
                  <strong>{entry.action === 'transfer' ? 'Передача' : 'Возврат'}</strong>
                  <span>{formatDate(entry.date)}</span>
                </div>
                {entry.usedBy && <div className="stock-transfer-target">{entry.usedBy}</div>}
                {entry.comment && <div className="stock-transfer-comment">{entry.comment}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {product.description && (
        <Card className="detail-block">
          <h3 className="stock-detail-section-title">Описание</h3>
          <div className="stock-detail-description">{product.description}</div>
        </Card>
      )}

      {transferOpen && (
        <TransferModal
          onClose={() => setTransferOpen(false)}
          onSave={(target, comment) => {
            db.transferProduct(product.id, target, comment)
            refresh()
            setTransferOpen(false)
          }}
        />
      )}
    </div>
  )
}

function categoryLabel(product: Product): string {
  if (product.inventoryCategory === 'tool') return 'Инструмент'
  if (product.inventoryCategory === 'consumable') return 'Расходники'
  return 'Материалы'
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

function TransferModal({ onClose, onSave }: { onClose: () => void; onSave: (target: string, comment: string) => void }) {
  const [target, setTarget] = useState('')
  const [comment, setComment] = useState('')
  const submit = () => {
    if (!target.trim()) return
    onSave(target.trim(), comment.trim())
  }
  return (
    <Modal title="Передача позиции" onClose={onClose}>
      <div className="form">
        <Field label="У кого или где используется *">
          <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Иван / объект №3" autoFocus />
        </Field>
        <Field label="Комментарий">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Дополнительная информация" />
        </Field>
        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit}>Передать</Button>
        </div>
      </div>
    </Modal>
  )
}
