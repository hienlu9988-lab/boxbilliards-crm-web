import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus,
  ArrowLeft,
  LayoutDashboard,
  Briefcase,
  ShoppingCart,
  Package,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  RotateCcw,
  Eye,
  Undo2,
  TrendingUp,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Sparkles,
  Pencil,
  Cloud,
  CloudOff,
  Download,
  Upload
} from 'lucide-react';

// ================= CẤU HÌNH SUPABASE (DÁN 2 MÃ CỦA BẠN VÀO ĐÂY) =================
const SUPABASE_URL = 'https://glbmcafoxswychwpdcum.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_S4WY4aZBbbc0ms4ewl-XYA_chWTPlIZ';
// ================================================================================

const isSupabaseConfigured =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const CRM_RECORD_ID = 'boxbilliards_main';

// --- KHỞI TẠO HỆ THỐNG TRỐNG ---
const emptyProducts = [];
const emptyCustomers = [];
const emptyPAKDs = [];
const emptySalesOrders = [];
const emptyGoodsReceipts = [];
const emptyGoodsIssues = [];

// --- HELPER FUNCTIONS ---

function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.error(e);
    }
  }, [key, state]);

  return [state, setState];
}

function parseDateTimestamp(dateStr) {
  if (!dateStr) return 0;
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day).getTime() || 0;
    }
  }
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByDateField(list, field, order) {
  if (!order) return list;
  return [...list].sort((a, b) => {
    const tA = parseDateTimestamp(a[field]);
    const tB = parseDateTimestamp(b[field]);
    return order === 'asc' ? tA - tB : tB - tA;
  });
}

function resolveItemBrand(item, products) {
  if (item.brand && item.brand.trim()) return item.brand.trim().toUpperCase();
  const prod = products.find((p) => p.sku.toLowerCase() === (item.sku || '').trim().toLowerCase());
  if (prod && prod.brand && prod.brand.trim()) return prod.brand.trim().toUpperCase();

  const text = `${item.sku || ''} ${item.name || ''}`;
  const hieuMatch = text.match(/hiệu\s*:?\s*([^,]+)/i);
  if (hieuMatch && hieuMatch[1]) return hieuMatch[1].trim().toUpperCase();

  const knownBrands = ['PREDATOR', 'MEZZ', 'CUETEC', 'PERI', 'HOW', 'KAMUI', 'UNIVERSAL', 'FURY'];
  for (const b of knownBrands) {
    if (text.toUpperCase().includes(b)) return b;
  }
  if (text.toUpperCase().includes('PRE ')) return 'PREDATOR';
  return 'KHÁC';
}

function getHistoricalDescriptionsForSKU(sku, products, goodsReceipts, pakds) {
  const normalized = (sku || '').trim().toLowerCase();
  if (!normalized) return [];

  const descList = [];
  const addDesc = (text) => {
    const clean = (text || '').trim();
    if (clean && !descList.some((d) => d.toLowerCase() === clean.toLowerCase())) {
      descList.push(clean);
    }
  };

  const matchedProd = products.find((p) => p.sku.trim().toLowerCase() === normalized);
  if (matchedProd) {
    addDesc(matchedProd.name);
    if (Array.isArray(matchedProd.descriptions)) {
      matchedProd.descriptions.forEach(addDesc);
    }
  }

  goodsReceipts.forEach((grn) => {
    (grn.items || []).forEach((item) => {
      if ((item.sku || '').trim().toLowerCase() === normalized) {
        addDesc(item.name);
      }
    });
  });

  pakds.forEach((pakd) => {
    (pakd.items || []).forEach((item) => {
      if ((item.sku || '').trim().toLowerCase() === normalized) {
        addDesc(item.name);
      }
    });
  });

  return descList;
}

function SortableDateHeader({ label, sortOrder, onToggle, className = 'p-4' }) {
  const nextOrder = () => {
    if (sortOrder === null) onToggle('asc');
    else if (sortOrder === 'asc') onToggle('desc');
    else onToggle(null);
  };

  return (
    <th className={className}>
      <button
        type="button"
        onClick={nextOrder}
        title="Bấm để sắp xếp ngày tăng dần hoặc giảm dần"
        className={`inline-flex items-center gap-1.5 uppercase font-semibold transition-colors ${
          sortOrder ? 'text-orange-400' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <span>{label}</span>
        {sortOrder === 'asc' && (
          <span className="inline-flex items-center gap-0.5 bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-[10px]">
            <ArrowUp size={12} /> Tăng
          </span>
        )}
        {sortOrder === 'desc' && (
          <span className="inline-flex items-center gap-0.5 bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-[10px]">
            <ArrowDown size={12} /> Giảm
          </span>
        )}
        {!sortOrder && <ArrowUpDown size={13} className="opacity-60" />}
      </button>
    </th>
  );
}

// ================= CUSTOM SELECT VỚI Ô TÌM KIẾM =================
function SearchableSelect({ options, value, onChange, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedOption = options.find((opt) => opt.value === value);
  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.brand && opt.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'}`}>
      <div
        className={`w-full bg-neutral-900 border ${
          isOpen ? 'border-orange-500' : 'border-neutral-700'
        } rounded px-2.5 py-1.5 text-xs text-white flex justify-between items-center cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="leading-snug pr-3">
          {selectedOption ? (
            <>
              <span className="font-mono font-bold text-orange-400 mr-1.5">[{selectedOption.value}]</span>
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-neutral-400">{placeholder}</span>
          )}
        </span>
        <ArrowDownToLine size={12} className="text-neutral-500 shrink-0" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-2xl max-h-64 flex flex-col">
          <div className="p-2 border-b border-neutral-700 shrink-0 bg-neutral-900 rounded-t-lg">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                autoFocus
                type="text"
                placeholder="Tìm tên hàng, SKU hoặc Brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-8 py-1.5 text-xs text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="p-3 text-xs text-amber-400 text-center">
                Chưa có SKU nào trong kho. Hãy tạo Phiếu nhập kho đầu vào trước để lưu danh mục hàng hóa.
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className="px-3 py-2 text-xs text-neutral-200 hover:bg-orange-600 hover:text-white cursor-pointer rounded mb-0.5 transition-colors"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold">{opt.value}</span>
                    {opt.brand && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-orange-300">
                        {opt.brand}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-95 leading-snug mt-0.5">{opt.label}</div>
                </div>
              ))
            ) : (
              <div className="p-3 text-xs text-neutral-500 text-center">Không tìm thấy sản phẩm phù hợp</div>
            )}
          </div>
        </div>
      )}

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>}
    </div>
  );
}

// =================================================================

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPAKDId, setSelectedPAKDId] = useState(null);
  const [notification, setNotification] = useState(null);

  const [products, setProducts] = useLocalStorage('bb_clean_products', emptyProducts);
  const [customers, setCustomers] = useLocalStorage('bb_clean_customers', emptyCustomers);
  const [pakds, setPakds] = useLocalStorage('bb_clean_pakds', emptyPAKDs);
  const [salesOrders, setSalesOrders] = useLocalStorage('bb_clean_sos', emptySalesOrders);
  const [goodsReceipts, setGoodsReceipts] = useLocalStorage('bb_clean_grns', emptyGoodsReceipts);
  const [goodsIssues, setGoodsIssues] = useLocalStorage('bb_clean_gins', emptyGoodsIssues);

  const [history, setHistory] = useLocalStorage('bb_clean_history', []);

  // Trạng thái đồng bộ đám mây Supabase
  const [isHydrated, setIsHydrated] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured ? 'loading' : 'offline');
  const [lastSyncTime, setLastSyncTime] = useState('');
  const isRemoteApplyingRef = useRef(false);
  const lastAppliedJsonRef = useRef('');
  const importFileInputRef = useRef(null);

  const [inboundDateSort, setInboundDateSort] = useState(null);
  const [pakdDateSort, setPakdDateSort] = useState(null);
  const [soDateSort, setSoDateSort] = useState(null);
  const [pakdDetailSoDateSort, setPakdDetailSoDateSort] = useState(null);
  const [outboundDateSort, setOutboundDateSort] = useState(null);

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const applyRemotePayload = (data) => {
    if (!data || typeof data !== 'object') return;
    isRemoteApplyingRef.current = true;
    if (Array.isArray(data.products)) setProducts(data.products);
    if (Array.isArray(data.customers)) setCustomers(data.customers);
    if (Array.isArray(data.pakds)) setPakds(data.pakds);
    if (Array.isArray(data.salesOrders)) setSalesOrders(data.salesOrders);
    if (Array.isArray(data.goodsReceipts)) setGoodsReceipts(data.goodsReceipts);
    if (Array.isArray(data.goodsIssues)) setGoodsIssues(data.goodsIssues);
    lastAppliedJsonRef.current = JSON.stringify({
      products: data.products || [],
      customers: data.customers || [],
      pakds: data.pakds || [],
      salesOrders: data.salesOrders || [],
      goodsReceipts: data.goodsReceipts || [],
      goodsIssues: data.goodsIssues || [],
    });
    setTimeout(() => {
      isRemoteApplyingRef.current = false;
    }, 300);
  };

  // 1. Nạp dữ liệu từ Supabase khi mở web + Lắng nghe cập nhật thời gian thực từ các máy khác
  useEffect(() => {
    if (!supabase) {
      setIsHydrated(true);
      setCloudStatus('offline');
      return;
    }

    let cancelled = false;

    async function initCloudSync() {
      try {
        const { data: row, error } = await supabase
          .from('crm_store')
          .select('data')
          .eq('id', CRM_RECORD_ID)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (row && row.data) {
          applyRemotePayload(row.data);
          setCloudStatus('synced');
          setLastSyncTime(
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
        } else {
          // Lần đầu tiên chạy: đẩy dữ liệu hiện có trên máy lên Supabase để chia sẻ chung
          const initialPayload = {
            products,
            customers,
            pakds,
            salesOrders,
            goodsReceipts,
            goodsIssues,
          };
          lastAppliedJsonRef.current = JSON.stringify(initialPayload);
          const { error: upsertErr } = await supabase.from('crm_store').upsert({
            id: CRM_RECORD_ID,
            data: initialPayload,
            updated_at: new Date().toISOString(),
          });
          if (!cancelled) {
            setCloudStatus(upsertErr ? 'error' : 'synced');
            setLastSyncTime(
              new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
          }
        }
      } catch (err) {
        console.error('Supabase init error:', err);
        if (!cancelled) setCloudStatus('error');
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }

    initCloudSync();

    // Lắng nghe thay đổi từ các nhân viên khác theo thời gian thực
    const channel = supabase
      .channel('crm_store_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_store', filter: `id=eq.${CRM_RECORD_ID}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            const incomingStr = JSON.stringify({
              products: payload.new.data.products || [],
              customers: payload.new.data.customers || [],
              pakds: payload.new.data.pakds || [],
              salesOrders: payload.new.data.salesOrders || [],
              goodsReceipts: payload.new.data.goodsReceipts || [],
              goodsIssues: payload.new.data.goodsIssues || [],
            });
            if (incomingStr !== lastAppliedJsonRef.current) {
              applyRemotePayload(payload.new.data);
              setCloudStatus('synced');
              setLastSyncTime(
                new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              );
              notify('Dữ liệu vừa được đồng bộ tự động từ đồng nghiệp!');
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Tự động đẩy dữ liệu lên Supabase mỗi khi bạn thêm / sửa / xóa trên web
  useEffect(() => {
    if (!isHydrated || !supabase || isRemoteApplyingRef.current) return;

    const currentSnapshotObj = {
      products,
      customers,
      pakds,
      salesOrders,
      goodsReceipts,
      goodsIssues,
    };
    const currentJson = JSON.stringify(currentSnapshotObj);
    if (currentJson === lastAppliedJsonRef.current) return;

    setCloudStatus('saving');
    const timer = setTimeout(async () => {
      try {
        lastAppliedJsonRef.current = currentJson;
        const { error } = await supabase.from('crm_store').upsert({
          id: CRM_RECORD_ID,
          data: currentSnapshotObj,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setCloudStatus('synced');
        setLastSyncTime(
          new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } catch (err) {
        console.error('Supabase sync error:', err);
        setCloudStatus('error');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isHydrated, products, customers, pakds, salesOrders, goodsReceipts, goodsIssues]);

  // Xuất file sao lưu thủ công (.json)
  const handleExportBackupFile = () => {
    const payload = {
      products,
      customers,
      pakds,
      salesOrders,
      goodsReceipts,
      goodsIssues,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `boxbilliards-crm-backup-${dateTag}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Đã tải xuống file sao lưu dữ liệu CRM!');
  };

  // Nạp dữ liệu từ file sao lưu (.json)
  const handleImportBackupFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
        saveCheckpoint('Nạp dữ liệu từ file sao lưu');
        if (Array.isArray(parsed.products)) setProducts(parsed.products);
        if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
        if (Array.isArray(parsed.pakds)) setPakds(parsed.pakds);
        if (Array.isArray(parsed.salesOrders)) setSalesOrders(parsed.salesOrders);
        if (Array.isArray(parsed.goodsReceipts)) setGoodsReceipts(parsed.goodsReceipts);
        if (Array.isArray(parsed.goodsIssues)) setGoodsIssues(parsed.goodsIssues);
        notify('Đã nạp dữ liệu từ file sao lưu & đồng bộ lên Cloud thành công!');
      } catch {
        alert('File sao lưu không đúng định dạng JSON của hệ thống!');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const saveCheckpoint = (actionLabel) => {
    const snapshot = {
      products: JSON.parse(JSON.stringify(products)),
      customers: JSON.parse(JSON.stringify(customers)),
      pakds: JSON.parse(JSON.stringify(pakds)),
      salesOrders: JSON.parse(JSON.stringify(salesOrders)),
      goodsReceipts: JSON.parse(JSON.stringify(goodsReceipts)),
      goodsIssues: JSON.parse(JSON.stringify(goodsIssues)),
    };

    setHistory((prev) => [
      ...prev.slice(-14),
      {
        label: actionLabel,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        snapshot,
      },
    ]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;

    const lastEntry = history[history.length - 1];
    const { snapshot } = lastEntry;

    setProducts(snapshot.products);
    setCustomers(snapshot.customers);
    setPakds(snapshot.pakds);
    setSalesOrders(snapshot.salesOrders);
    setGoodsReceipts(snapshot.goodsReceipts);
    setGoodsIssues(snapshot.goodsIssues);

    if (currentView === 'pakd_detail' && !snapshot.pakds.some((p) => p.id === selectedPAKDId)) {
      setCurrentView('pakd_list');
      setSelectedPAKDId(null);
    }

    setHistory((prev) => prev.slice(0, -1));
    notify(`Đã Back về trước thao tác: ${lastEntry.label}`);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (history.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const clearAllData = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu hiện tại để làm mới hệ thống từ đầu?')) {
      saveCheckpoint('Xóa toàn bộ dữ liệu');
      setProducts(emptyProducts);
      setCustomers(emptyCustomers);
      setPakds(emptyPAKDs);
      setSalesOrders(emptySalesOrders);
      setGoodsReceipts(emptyGoodsReceipts);
      setGoodsIssues(emptyGoodsIssues);
      setCurrentView('dashboard');
      notify('Đã làm mới toàn bộ hệ thống về trạng thái trống!');
    }
  };

  // Các hàm XÓA dữ liệu
  const handleDeleteCustomer = (id, name) => {
    if (window.confirm(`Xóa khách hàng ${name}? Việc này KHÔNG xóa các phiếu liên quan.`)) {
      saveCheckpoint(`Xóa KH: ${name}`);
      setCustomers(customers.filter((c) => c.id !== id));
      notify(`Đã xóa khách hàng ${name}`);
    }
  };

  const handleDeletePAKD = (id, code) => {
    if (window.confirm(`CẢNH BÁO: Xóa Phương án ${code} sẽ XÓA LUÔN các Sales Order thuộc phương án này chưa xuất kho. Tiếp tục?`)) {
      saveCheckpoint(`Xóa PAKD: ${code}`);
      setSalesOrders(salesOrders.filter((so) => so.pakd_id !== id || so.status === 'Đã xuất kho'));
      setPakds(pakds.filter((p) => p.id !== id));
      if (currentView === 'pakd_detail') setCurrentView('pakd_list');
      notify(`Đã xóa Phương án kinh doanh ${code}`);
    }
  };

  const handleDeleteSO = (id, code) => {
    if (window.confirm(`Xóa Sales Order ${code}? (Chỉ xóa được khi chưa xuất kho)`)) {
      saveCheckpoint(`Xóa SO: ${code}`);
      setSalesOrders(salesOrders.filter((so) => so.id !== id));
      notify(`Đã xóa Sales Order ${code}`);
    }
  };

  const handleDeleteGRN = (id, code) => {
    if (window.confirm(`Xóa Phiếu nhập ${code}? (Sẽ trừ lại tồn kho đã nhập)`)) {
      saveCheckpoint(`Xóa PNK: ${code}`);

      const grnToDelete = goodsReceipts.find((g) => g.id === id);
      if (grnToDelete) {
        let updatedProducts = [...products];
        grnToDelete.items.forEach((line) => {
          const idx = updatedProducts.findIndex((p) => p.sku.toLowerCase() === line.sku.toLowerCase());
          if (idx >= 0) {
            updatedProducts[idx] = {
              ...updatedProducts[idx],
              stock: Math.max(0, Number(updatedProducts[idx].stock) - Number(line.qty)),
            };
          }
        });
        setProducts(updatedProducts);
      }
      setGoodsReceipts(goodsReceipts.filter((g) => g.id !== id));
      notify(`Đã xóa phiếu nhập ${code} và điều chỉnh tồn kho`);
    }
  };

  const handleDeleteGIN = (id, code, so_code) => {
    if (window.confirm(`Xóa Phiếu xuất ${code}? (Sẽ cộng lại tồn kho và chuyển SO về trạng thái Chờ xuất)`)) {
      saveCheckpoint(`Xóa PXK: ${code}`);

      const ginToDelete = goodsIssues.find((g) => g.id === id);
      if (ginToDelete) {
        let updatedProducts = [...products];
        ginToDelete.items.forEach((line) => {
          const idx = updatedProducts.findIndex((p) => p.sku.toLowerCase() === line.sku.toLowerCase());
          if (idx >= 0) {
            updatedProducts[idx] = {
              ...updatedProducts[idx],
              stock: Number(updatedProducts[idx].stock) + Number(line.qty),
            };
          }
        });
        setProducts(updatedProducts);
        setSalesOrders(salesOrders.map((so) => (so.so_code === so_code ? { ...so, status: 'Chờ xuất kho' } : so)));
      }
      setGoodsIssues(goodsIssues.filter((g) => g.id !== id));
      notify(`Đã xóa phiếu xuất ${code} và cộng lại tồn kho`);
    }
  };

  const confirmDeleteProduct = (prod) => {
    saveCheckpoint(`Xóa mã SKU: ${prod.sku}`);
    setProducts(products.filter((p) => p.sku !== prod.sku));
    setDeletingProduct(null);
    notify(`Đã xóa mã SKU ${prod.sku} khỏi danh mục tồn kho!`);
  };

  const getPAKDItemStats = (pakdId, sku, excludeSoId = null) => {
    const relatedSOs = salesOrders.filter(
      (so) => so.pakd_id === pakdId && (!excludeSoId || so.id !== excludeSoId)
    );
    let shipped = 0;
    let pending = 0;
    relatedSOs.forEach((so) => {
      const line = so.items.find((i) => i.sku === sku);
      if (line) {
        if (so.status === 'Đã xuất kho') shipped += Number(line.qty);
        else pending += Number(line.qty);
      }
    });
    return { shipped, pending };
  };

  const totalPAKDAmount = pakds.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + Number(i.total_qty) * Number(i.price), 0),
    0
  );
  const getCustomerTotalAmount = (customerId) =>
    pakds
      .filter((p) => p.customer_id === customerId)
      .reduce((sum, p) => sum + p.items.reduce((s, i) => s + Number(i.total_qty) * Number(i.price), 0), 0);

  const inboundSummary = goodsReceipts.reduce(
    (acc, grn) => {
      grn.items.forEach((item) => {
        const qty = Number(item.qty) || 0;
        const val = qty * (Number(item.import_price) || 0);
        const brand = resolveItemBrand(item, products);

        acc.totalQty += qty;
        acc.totalValue += val;
        if (!acc.byBrand[brand]) {
          acc.byBrand[brand] = { qty: 0, value: 0 };
        }
        acc.byBrand[brand].qty += qty;
        acc.byBrand[brand].value += val;
      });
      return acc;
    },
    { totalQty: 0, totalValue: 0, byBrand: {} }
  );

  const brandBreakdownList = Object.entries(inboundSummary.byBrand).sort((a, b) => b[1].qty - a[1].qty);

  const sortedGoodsReceipts = sortByDateField(goodsReceipts, 'date', inboundDateSort);
  const sortedPAKDs = sortByDateField(pakds, 'date', pakdDateSort);
  const sortedSalesOrders = sortByDateField(salesOrders, 'order_date', soDateSort);
  const sortedGoodsIssues = sortByDateField(goodsIssues, 'date', outboundDateSort);

  const [showCreatePAKD, setShowCreatePAKD] = useState(false);
  const [editingPAKD, setEditingPAKD] = useState(null);

  const [showCreateSO, setShowCreateSO] = useState(false);
  const [editingSO, setEditingSO] = useState(null);

  const [showCreateGRN, setShowCreateGRN] = useState(false);
  const [editingGRN, setEditingGRN] = useState(null);

  const [issuingSO, setIssuingSO] = useState(null);
  const [viewingGRN, setViewingGRN] = useState(null);
  const [viewingGIN, setViewingGIN] = useState(null);
  const [editingGIN, setEditingGIN] = useState(null);

  const [showCustomerLeaderboard, setShowCustomerLeaderboard] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);

  const selectedPAKD = pakds.find((p) => p.id === selectedPAKDId);
  const lastAction = history.length > 0 ? history[history.length - 1] : null;

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
    { id: 'inbound', icon: ArrowDownToLine, label: '1. Nhập kho (Đầu vào)' },
    { id: 'pakd_list', icon: Briefcase, label: '2. Phương án KD' },
    { id: 'sales_orders', icon: ShoppingCart, label: '3. Sales Orders' },
    { id: 'outbound', icon: ArrowUpFromLine, label: '4. Phiếu xuất kho' },
    { id: 'customers', icon: Users, label: 'Khách hàng' },
    { id: 'inventory', icon: Package, label: 'Tồn kho thực tế' },
  ];

  // --- HANDLERS LƯU CHỈNH SỬA ---

  const handleUpdateGRN = (oldGRN, updatedGRN) => {
    saveCheckpoint(`Sửa PNK: ${oldGRN.receipt_code}`);
    let updatedProducts = [...products];

    oldGRN.items.forEach((oldLine) => {
      const idx = updatedProducts.findIndex(
        (p) => p.sku.trim().toLowerCase() === oldLine.sku.trim().toLowerCase()
      );
      if (idx >= 0) {
        updatedProducts[idx] = {
          ...updatedProducts[idx],
          stock: Math.max(0, Number(updatedProducts[idx].stock) - Number(oldLine.qty)),
        };
      }
    });

    updatedGRN.items.forEach((line) => {
      const cleanSku = line.sku.trim().toUpperCase();
      const cleanDesc = (line.name || '').trim() || cleanSku;
      const cleanBrand =
        (line.brand || '').trim().toUpperCase() ||
        resolveItemBrand({ sku: cleanSku, name: cleanDesc }, updatedProducts);
      const importPrice = Number(line.import_price) || 0;
      const qty = Number(line.qty) || 0;

      const idx = updatedProducts.findIndex(
        (p) => p.sku.trim().toLowerCase() === cleanSku.toLowerCase()
      );
      if (idx >= 0) {
        const prevDescs = Array.isArray(updatedProducts[idx].descriptions)
          ? updatedProducts[idx].descriptions
          : [updatedProducts[idx].name].filter(Boolean);
        const mergedDescs = prevDescs.some((d) => d.toLowerCase() === cleanDesc.toLowerCase())
          ? prevDescs
          : [cleanDesc, ...prevDescs];

        updatedProducts[idx] = {
          ...updatedProducts[idx],
          brand: cleanBrand !== 'KHÁC' ? cleanBrand : updatedProducts[idx].brand,
          name: cleanDesc,
          descriptions: mergedDescs,
          cost: importPrice > 0 ? importPrice : updatedProducts[idx].cost,
          stock: Number(updatedProducts[idx].stock) + qty,
        };
      } else {
        updatedProducts.push({
          sku: cleanSku,
          brand: cleanBrand,
          name: cleanDesc,
          descriptions: [cleanDesc],
          unit: 'pcs',
          cost: importPrice,
          price: Math.round(importPrice * 1.3),
          stock: qty,
        });
      }
    });

    const normalizedGRN = {
      ...updatedGRN,
      id: oldGRN.id,
      items: updatedGRN.items.map((line) => ({
        ...line,
        sku: line.sku.trim().toUpperCase(),
        brand: (line.brand || '').trim().toUpperCase() || resolveItemBrand(line, updatedProducts),
        name: (line.name || '').trim() || line.sku.trim().toUpperCase(),
      })),
    };

    setProducts(updatedProducts);
    setGoodsReceipts(goodsReceipts.map((g) => (g.id === oldGRN.id ? normalizedGRN : g)));
    setEditingGRN(null);
    notify(`Đã cập nhật Phiếu nhập kho ${normalizedGRN.receipt_code} & đồng bộ tồn kho!`);
  };

  const handleUpdatePAKD = (oldPAKD, updatedPAKD, customerInfo) => {
    saveCheckpoint(`Sửa PAKD: ${oldPAKD.code}`);
    let updatedCustomers = [...customers];
    const trimmedCustName = customerInfo.name.trim();
    const matchedIdx = updatedCustomers.findIndex(
      (c) => c.name.trim().toLowerCase() === trimmedCustName.toLowerCase()
    );

    let finalCustId = oldPAKD.customer_id;

    if (matchedIdx >= 0) {
      const targetCust = updatedCustomers[matchedIdx];
      finalCustId = targetCust.id;
      updatedCustomers[matchedIdx] = {
        ...targetCust,
        company: customerInfo.company.trim() || targetCust.company,
        region: customerInfo.region || targetCust.region,
        total_pakd:
          targetCust.id === oldPAKD.customer_id
            ? targetCust.total_pakd
            : targetCust.total_pakd + 1,
      };
      if (targetCust.id !== oldPAKD.customer_id) {
        updatedCustomers = updatedCustomers.map((c) =>
          c.id === oldPAKD.customer_id
            ? { ...c, total_pakd: Math.max(0, Number(c.total_pakd) - 1) }
            : c
        );
      }
    } else {
      finalCustId = `KH-00${updatedCustomers.length + 1}`;
      updatedCustomers = updatedCustomers.map((c) =>
        c.id === oldPAKD.customer_id
          ? { ...c, total_pakd: Math.max(0, Number(c.total_pakd) - 1) }
          : c
      );
      updatedCustomers.push({
        id: finalCustId,
        name: trimmedCustName,
        company: customerInfo.company.trim(),
        region: customerInfo.region || 'Hồ Chí Minh',
        total_pakd: 1,
      });
    }

    const finalPAKD = {
      ...updatedPAKD,
      id: oldPAKD.id,
      customer_id: finalCustId,
      customer_name: trimmedCustName,
    };

    const affectedSoCodes = salesOrders
      .filter((so) => so.pakd_id === oldPAKD.id)
      .map((so) => so.so_code);

    setCustomers(updatedCustomers);
    setPakds(pakds.map((p) => (p.id === oldPAKD.id ? finalPAKD : p)));
    setSalesOrders(
      salesOrders.map((so) =>
        so.pakd_id === oldPAKD.id
          ? { ...so, pakd_code: finalPAKD.code, customer_name: trimmedCustName }
          : so
      )
    );
    setGoodsIssues(
      goodsIssues.map((gin) =>
        affectedSoCodes.includes(gin.so_code)
          ? { ...gin, pakd_code: finalPAKD.code, customer_name: trimmedCustName }
          : gin
      )
    );
    setEditingPAKD(null);
    notify(`Đã cập nhật Phương án kinh doanh ${finalPAKD.code}!`);
  };

  const handleUpdateSO = (oldSO, updatedSO) => {
    saveCheckpoint(`Sửa SO: ${oldSO.so_code}`);
    const finalSO = {
      ...updatedSO,
      id: oldSO.id,
      status: oldSO.status,
    };

    setSalesOrders(salesOrders.map((s) => (s.id === oldSO.id ? finalSO : s)));

    if (oldSO.status === 'Đã xuất kho') {
      let updatedProducts = [...products];
      oldSO.items.forEach((oldLine) => {
        const idx = updatedProducts.findIndex(
          (p) => p.sku.toLowerCase() === oldLine.sku.toLowerCase()
        );
        if (idx >= 0) {
          updatedProducts[idx] = {
            ...updatedProducts[idx],
            stock: Number(updatedProducts[idx].stock) + Number(oldLine.qty),
          };
        }
      });
      finalSO.items.forEach((newLine) => {
        const idx = updatedProducts.findIndex(
          (p) => p.sku.toLowerCase() === newLine.sku.toLowerCase()
        );
        if (idx >= 0) {
          updatedProducts[idx] = {
            ...updatedProducts[idx],
            stock: Math.max(0, Number(updatedProducts[idx].stock) - Number(newLine.qty)),
          };
        }
      });
      setProducts(updatedProducts);

      setGoodsIssues(
        goodsIssues.map((gin) =>
          gin.so_code === oldSO.so_code
            ? {
                ...gin,
                so_code: finalSO.so_code,
                warehouse: finalSO.warehouse,
                items: finalSO.items.map(({ sku, name, qty }) => ({ sku, name, qty })),
              }
            : gin
        )
      );
    }

    setEditingSO(null);
    notify(`Đã cập nhật Sales Order ${finalSO.so_code}!`);
  };

  const handleUpdateGIN = (oldGIN, updatedGIN) => {
    saveCheckpoint(`Sửa PXK: ${oldGIN.issue_code}`);
    let updatedProducts = [...products];

    oldGIN.items.forEach((oldLine) => {
      const idx = updatedProducts.findIndex(
        (p) => p.sku.toLowerCase() === oldLine.sku.toLowerCase()
      );
      if (idx >= 0) {
        updatedProducts[idx] = {
          ...updatedProducts[idx],
          stock: Number(updatedProducts[idx].stock) + Number(oldLine.qty),
        };
      }
    });

    updatedGIN.items.forEach((newLine) => {
      const idx = updatedProducts.findIndex(
        (p) => p.sku.toLowerCase() === newLine.sku.toLowerCase()
      );
      if (idx >= 0) {
        updatedProducts[idx] = {
          ...updatedProducts[idx],
          stock: Math.max(0, Number(updatedProducts[idx].stock) - Number(newLine.qty)),
        };
      }
    });

    const finalGIN = {
      ...updatedGIN,
      id: oldGIN.id,
    };

    setProducts(updatedProducts);
    setGoodsIssues(goodsIssues.map((g) => (g.id === oldGIN.id ? finalGIN : g)));

    setSalesOrders(
      salesOrders.map((so) =>
        so.so_code === oldGIN.so_code
          ? {
              ...so,
              warehouse: finalGIN.warehouse,
              items: so.items.map((soItem) => {
                const editedLine = finalGIN.items.find((i) => i.sku === soItem.sku);
                return editedLine ? { ...soItem, qty: Number(editedLine.qty) } : soItem;
              }),
            }
          : so
      )
    );

    setEditingGIN(null);
    notify(`Đã cập nhật Phiếu xuất kho ${finalGIN.issue_code} & đồng bộ tồn kho!`);
  };

  return (
    <div className="flex h-screen bg-neutral-950 font-sans text-neutral-200">
      <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-neutral-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-600 rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-600/30">
            B
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Box Billiards</h1>
            <p className="text-xs font-semibold text-orange-500">Box Billiards CRM - Internal</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const active = currentView === item.id || (currentView === 'pakd_detail' && item.id === 'pakd_list');
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-orange-600 text-white font-semibold shadow-md shadow-orange-950'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-neutral-800 space-y-2">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-semibold border transition-colors ${
              history.length > 0
                ? 'bg-neutral-900 hover:bg-orange-600 text-orange-400 hover:text-white border-orange-500/40'
                : 'bg-neutral-950 text-neutral-600 border-neutral-900 cursor-not-allowed'
            }`}
          >
            <Undo2 size={14} /> Back điều chỉnh trước ({history.length})
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleExportBackupFile}
              title="Tải file sao lưu dữ liệu về máy"
              className="flex items-center justify-center gap-1 text-[11px] text-neutral-300 hover:text-orange-400 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg transition-colors"
            >
              <Download size={13} /> Xuất file
            </button>
            <button
              type="button"
              onClick={() => importFileInputRef.current?.click()}
              title="Nạp dữ liệu từ file sao lưu"
              className="flex items-center justify-center gap-1 text-[11px] text-neutral-300 hover:text-orange-400 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg transition-colors"
            >
              <Upload size={13} /> Nạp file
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackupFile}
              className="hidden"
            />
          </div>

          <button
            onClick={clearAllData}
            className="w-full flex items-center justify-center gap-2 text-xs text-neutral-500 hover:text-red-400 py-1.5 border border-neutral-800 rounded-lg transition-colors"
          >
            <RotateCcw size={14} /> Xóa sạch dữ liệu
          </button>
        </div>
      </aside>

      <main className="flex-1 relative overflow-hidden flex flex-col bg-neutral-950">
        <div className="bg-black/80 border-b border-neutral-800 px-6 py-2.5 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            {cloudStatus === 'synced' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 font-medium">
                <Cloud size={13} /> Đã đồng bộ Cloud dùng chung (Supabase • {lastSyncTime})
              </span>
            )}
            {cloudStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/60 text-amber-300 font-medium">
                <Cloud size={13} /> Đang đồng bộ lên Cloud...
              </span>
            )}
            {cloudStatus === 'loading' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300">
                <Cloud size={13} className="text-orange-400" /> Đang tải dữ liệu chung...
              </span>
            )}
            {cloudStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950/60 border border-red-800/60 text-red-400 font-medium">
                <CloudOff size={13} /> Lỗi kết nối Supabase (Kiểm tra lại URL/Key hoặc bảng crm_store)
              </span>
            )}
            {cloudStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300">
                <CloudOff size={13} className="text-orange-400" /> Chưa gắn Supabase (Đang lưu trên trình duyệt)
              </span>
            )}

            {lastAction && (
              <span className="hidden xl:inline">
                Thao tác gần nhất: <strong className="text-neutral-200">{lastAction.label}</strong>{' '}
                <span className="text-neutral-500">({lastAction.time})</span>
              </span>
            )}
          </div>

          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Quay lại trạng thái trước điều chỉnh gần nhất (Ctrl + Z)"
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              history.length > 0
                ? 'bg-neutral-900 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/50 shadow-sm'
                : 'bg-neutral-900/40 text-neutral-600 border border-neutral-800 cursor-not-allowed'
            }`}
          >
            <Undo2 size={15} />
            <span>Back về điều chỉnh trước</span>
            {history.length > 0 && (
              <span className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded text-[11px]">{history.length}</span>
            )}
          </button>
        </div>

        {notification && (
          <div className="absolute top-14 right-4 z-50 bg-neutral-900 border border-orange-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
            <CheckCircle size={20} className="text-orange-500 shrink-0" />
            <p className="font-medium text-sm">{notification}</p>
          </div>
        )}

        {/* --- VIEW 1: TỔNG QUAN --- */}
        {currentView === 'dashboard' && (
          <div className="p-8 overflow-y-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Tổng quan Vận hành</h2>
              <p className="text-neutral-400 text-sm mt-1">Theo dõi nhanh tiến độ Phương án kinh doanh và Kho vận</p>
            </div>
            <div className="grid grid-cols-4 gap-5">
              <div
                className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors"
                onClick={() => setCurrentView('pakd_list')}
              >
                <p className="text-neutral-400 text-xs uppercase font-semibold flex items-center justify-between">
                  Tổng Phương án KD <ArrowUpFromLine size={14} />
                </p>
                <div className="mt-2">
                  <p className="text-3xl font-bold text-white">
                    {pakds.length} <span className="text-sm text-neutral-500 font-normal">PAKD</span>
                  </p>
                  <p className="text-sm font-semibold text-emerald-400 mt-1">{totalPAKDAmount.toLocaleString()} VNĐ</p>
                </div>
              </div>
              <div
                className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors"
                onClick={() => setShowCustomerLeaderboard(true)}
              >
                <p className="text-neutral-400 text-xs uppercase font-semibold flex items-center justify-between">
                  Khách hàng hệ thống <Eye size={14} className="text-orange-400" />
                </p>
                <div className="mt-2">
                  <p className="text-3xl font-bold text-white">
                    {customers.length} <span className="text-sm text-neutral-500 font-normal">KH</span>
                  </p>
                  <p className="text-xs text-orange-400 mt-1.5 hover:underline flex items-center gap-1">
                    <TrendingUp size={12} /> Xem chi tiết doanh số KH
                  </p>
                </div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                <p className="text-neutral-400 text-xs uppercase font-semibold">Sales Order chờ xuất</p>
                <p className="text-3xl font-bold text-yellow-500 mt-2">
                  {salesOrders.filter((s) => s.status !== 'Đã xuất kho').length}
                </p>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                <p className="text-neutral-400 text-xs uppercase font-semibold">Tổng tồn kho thực tế</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">
                  {products.reduce((s, p) => s + Number(p.stock), 0)} <span className="text-sm text-neutral-500">SP</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: NHẬP KHO ĐẦU VÀO --- */}
        {currentView === 'inbound' && (
          <div className="p-8 overflow-y-auto space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Phiếu Nhập Kho Đầu Vào (Inbound)</h2>
                <p className="text-neutral-400 text-sm mt-1">Ghi nhận hàng nhập từ nhà cung cấp, tự động lưu SKU mới và cộng tồn kho</p>
              </div>
              <button
                onClick={() => setShowCreateGRN(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-orange-950"
              >
                <Plus size={18} /> TẠO PHIẾU NHẬP KHO
              </button>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4 shadow-lg">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-black/60 border border-neutral-800 rounded-xl p-4">
                  <p className="text-xs uppercase font-semibold text-neutral-400">Tổng giá trị nhập kho (Tất cả phiếu)</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1.5">
                    {inboundSummary.totalValue.toLocaleString()} <span className="text-sm font-normal text-neutral-400">VNĐ</span>
                  </p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-xl p-4">
                  <p className="text-xs uppercase font-semibold text-neutral-400">Tổng số lượng đã nhập</p>
                  <p className="text-2xl font-extrabold text-orange-400 mt-1.5">
                    {inboundSummary.totalQty.toLocaleString()} <span className="text-sm font-normal text-neutral-400">SP ({goodsReceipts.length} phiếu)</span>
                  </p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-xl p-4">
                  <p className="text-xs uppercase font-semibold text-neutral-400">Số lượng Brand đã nhập</p>
                  <p className="text-2xl font-extrabold text-white mt-1.5">
                    {brandBreakdownList.length} <span className="text-sm font-normal text-neutral-400">Thương hiệu</span>
                  </p>
                </div>
              </div>
              <div className="border-t border-neutral-800 pt-3.5">
                <p className="text-xs uppercase font-bold text-neutral-400 mb-2.5">Tổng số lượng & giá trị nhập chia theo Brand:</p>
                {brandBreakdownList.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {brandBreakdownList.map(([brandName, stat]) => {
                      const pct = inboundSummary.totalQty > 0 ? Math.round((stat.qty / inboundSummary.totalQty) * 100) : 0;
                      return (
                        <div key={brandName} className="bg-neutral-950 border border-orange-500/30 rounded-lg px-3.5 py-2.5 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-orange-400 tracking-wide">{brandName}</span>
                            <span className="text-[11px] bg-orange-500/15 text-orange-300 px-1.5 py-0.5 rounded font-semibold">{pct}%</span>
                          </div>
                          <div className="mt-1.5 flex items-baseline justify-between">
                            <span className="text-lg font-bold text-white">{stat.qty.toLocaleString()} SP</span>
                            <span className="text-xs font-medium text-emerald-400">{stat.value.toLocaleString()} đ</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">Chưa có dữ liệu nhập kho theo Brand.</p>
                )}
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                    <th className="p-4">Số Phiếu Nhập</th>
                    <SortableDateHeader label="Ngày nhập" sortOrder={inboundDateSort} onToggle={setInboundDateSort} />
                    <th className="p-4">Nhà cung cấp</th>
                    <th className="p-4">Kho nhập</th>
                    <th className="p-4 text-right">Tổng SL nhập</th>
                    <th className="p-4 text-right">Tổng giá trị (VND)</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-sm">
                  {sortedGoodsReceipts.length > 0 ? (
                    sortedGoodsReceipts.map((grn) => {
                      const totQty = grn.items.reduce((s, i) => s + Number(i.qty), 0);
                      const totVal = grn.items.reduce((s, i) => s + Number(i.qty) * Number(i.import_price), 0);
                      return (
                        <tr key={grn.id} className="hover:bg-neutral-800/40">
                          <td className="p-4 font-bold text-orange-400 font-mono">{grn.receipt_code}</td>
                          <td className="p-4 text-neutral-300 font-medium">{grn.date}</td>
                          <td className="p-4 text-white">{grn.supplier}</td>
                          <td className="p-4 text-neutral-300">{grn.warehouse}</td>
                          <td className="p-4 text-right font-bold">{totQty}</td>
                          <td className="p-4 text-right font-semibold text-emerald-400">{totVal.toLocaleString()} đ</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => setViewingGRN(grn)}
                                className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Eye size={13} /> Xem
                              </button>
                              <button
                                onClick={() => setEditingGRN(grn)}
                                title="Sửa phiếu nhập kho"
                                className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-amber-600 text-amber-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Pencil size={13} /> Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteGRN(grn.id, grn.receipt_code)}
                                title="Xóa phiếu nhập kho"
                                className="p-1.5 text-neutral-500 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-neutral-500 text-sm">
                        Chưa có phiếu nhập kho nào. Bấm <strong className="text-orange-400">+ TẠO PHIẾU NHẬP KHO</strong> để bắt đầu.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-black/70 border-t border-neutral-700 font-bold text-sm">
                    <td colSpan="4" className="p-4 text-right text-neutral-300 uppercase text-xs">Tổng cộng toàn bộ phiếu nhập:</td>
                    <td className="p-4 text-right text-orange-400">{inboundSummary.totalQty.toLocaleString()} SP</td>
                    <td className="p-4 text-right text-emerald-400">{inboundSummary.totalValue.toLocaleString()} đ</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW 3: DANH SÁCH PHƯƠNG ÁN KINH DOANH --- */}
        {currentView === 'pakd_list' && (
          <div className="p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Quản lý Phương án Kinh doanh (PAKD)</h2>
                <p className="text-neutral-400 text-sm mt-1">Hợp đồng nguyên tắc / Dự án tổng theo từng khách hàng</p>
              </div>
              <button
                onClick={() => setShowCreatePAKD(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-orange-950"
              >
                <Plus size={18} /> TẠO PHƯƠNG ÁN MỚI
              </button>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                    <th className="p-4">Số PAKD</th>
                    <th className="p-4">Khách hàng</th>
                    <SortableDateHeader label="Ngày lập" sortOrder={pakdDateSort} onToggle={setPakdDateSort} />
                    <th className="p-4 text-right">Tổng giá trị (Incl.VAT)</th>
                    <th className="p-4 text-center">Tiến độ giao</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-sm">
                  {sortedPAKDs.length > 0 ? (
                    sortedPAKDs.map((p) => {
                      const totQty = p.items.reduce((s, i) => s + Number(i.total_qty), 0);
                      const totAmount = p.items.reduce((s, i) => s + Number(i.total_qty) * Number(i.price), 0);
                      const doneQty = p.items.reduce((s, i) => s + getPAKDItemStats(p.id, i.sku).shipped, 0);
                      const pct = totQty > 0 ? Math.round((doneQty / totQty) * 100) : 0;
                      return (
                        <tr key={p.id} className="hover:bg-neutral-800/40">
                          <td className="p-4 font-bold text-white">{p.code}</td>
                          <td className="p-4"><span className="font-semibold text-orange-400">{p.customer_name}</span></td>
                          <td className="p-4 text-neutral-300 font-medium">{p.date}</td>
                          <td className="p-4 text-right font-semibold text-white">{totAmount.toLocaleString()} đ</td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-24 bg-neutral-800 rounded-full h-2">
                                <div className={`h-2 rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-neutral-400 w-9">{pct}%</span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => { setSelectedPAKDId(p.id); setCurrentView('pakd_detail'); }}
                                className="bg-neutral-800 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Mở chi tiết
                              </button>
                              <button
                                onClick={() => setEditingPAKD(p)}
                                title="Sửa Phương án kinh doanh"
                                className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-amber-600 text-amber-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Pencil size={13} /> Sửa
                              </button>
                              <button
                                onClick={() => handleDeletePAKD(p.id, p.code)}
                                title="Xóa Phương án kinh doanh"
                                className="p-1.5 text-neutral-500 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-neutral-500 text-sm">
                        Chưa có Phương án kinh doanh nào. Bấm <strong className="text-orange-400">+ TẠO PHƯƠNG ÁN MỚI</strong> để bắt đầu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW 3B: CHI TIẾT PHƯƠNG ÁN & TẠO SALES ORDER --- */}
        {currentView === 'pakd_detail' && selectedPAKD && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-neutral-900 border-b border-neutral-800 p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView('pakd_list')} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"><ArrowLeft size={20} /></button>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedPAKD.code}</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Khách hàng: <span className="text-orange-400 font-semibold">{selectedPAKD.customer_name}</span> • Ngày: {selectedPAKD.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setEditingPAKD(selectedPAKD)}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-neutral-800 hover:bg-amber-600 text-amber-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Pencil size={15} /> Sửa PAKD
                </button>
                <button
                  onClick={() => handleDeletePAKD(selectedPAKD.id, selectedPAKD.code)}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold text-neutral-400 hover:bg-red-900/40 hover:text-red-400 border border-transparent hover:border-red-900 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={15} /> Xóa PAKD
                </button>
                <button
                  onClick={() => setShowCreateSO(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-orange-950"
                >
                  <Plus size={18} /> TẠO SALES ORDER
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-neutral-800 font-bold text-white text-sm">Bảng theo dõi số lượng cam kết & tiến độ giao hàng</div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                      <th className="p-3.5">Mã SKU</th>
                      <th className="p-3.5 w-1/3">Tên hàng hóa</th>
                      <th className="p-3.5 text-right">Đơn giá (Incl.VAT)</th>
                      <th className="p-3.5 text-center">Tổng cam kết</th>
                      <th className="p-3.5 text-center text-yellow-400">Đã lên SO (Chờ xuất)</th>
                      <th className="p-3.5 text-center text-emerald-400">Đã xuất kho</th>
                      <th className="p-3.5 text-center text-orange-400">SL CÒN LẠI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {selectedPAKD.items.map((item, idx) => {
                      const { shipped, pending } = getPAKDItemStats(selectedPAKD.id, item.sku);
                      const remaining = item.total_qty - shipped - pending;
                      return (
                        <tr key={idx} className="hover:bg-neutral-800/40">
                          <td className="p-3.5 font-mono font-semibold text-neutral-200">{item.sku}</td>
                          <td className="p-3.5 text-neutral-300 leading-tight">{item.name}</td>
                          <td className="p-3.5 text-right">{Number(item.price).toLocaleString()} đ</td>
                          <td className="p-3.5 text-center font-bold text-white">{item.total_qty}</td>
                          <td className="p-3.5 text-center text-yellow-400 font-semibold">{pending}</td>
                          <td className="p-3.5 text-center text-emerald-400 font-semibold">{shipped}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-3 py-1 rounded font-bold ${remaining > 0 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-neutral-800 text-neutral-500'}`}>{remaining}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-white">Các đợt giao hàng (Sales Orders) thuộc PAKD này</h3>
                  <button
                    type="button"
                    onClick={() => setPakdDetailSoDateSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null))}
                    className="inline-flex items-center gap-1.5 text-xs bg-neutral-900 border border-neutral-700 hover:border-orange-500 px-3 py-1.5 rounded-lg text-neutral-300"
                  >
                    <ArrowUpDown size={13} className="text-orange-400" />
                    <span>Sắp xếp ngày tạo: <strong className="text-orange-400">{pakdDetailSoDateSort === 'asc' ? 'Tăng dần' : pakdDetailSoDateSort === 'desc' ? 'Giảm dần' : 'Mặc định'}</strong></span>
                  </button>
                </div>
                {salesOrders.filter((so) => so.pakd_id === selectedPAKD.id).length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {sortByDateField(salesOrders.filter((so) => so.pakd_id === selectedPAKD.id), 'order_date', pakdDetailSoDateSort).map((so) => {
                      const totQty = so.items.reduce((s, i) => s + Number(i.qty), 0);
                      const matchedGIN = goodsIssues.find((g) => g.so_code === so.so_code);
                      return (
                        <div key={so.id} className="bg-neutral-900 border border-neutral-800 border-l-4 border-l-orange-500 p-4 rounded-xl relative group">
                          <div className="absolute top-3 right-3 flex items-center gap-1">
                            <button
                              onClick={() => setEditingSO(so)}
                              title="Sửa Sales Order"
                              className="text-neutral-400 hover:text-amber-400 p-1.5 bg-neutral-950 hover:bg-neutral-800 rounded transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            {so.status !== 'Đã xuất kho' && (
                              <button
                                onClick={() => handleDeleteSO(so.id, so.so_code)}
                                title="Xóa Sales Order"
                                className="text-neutral-500 hover:text-red-400 p-1.5 bg-neutral-950 hover:bg-neutral-800 rounded transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="flex justify-between items-start mb-2 pr-14">
                            <span className="font-bold text-white font-mono text-sm">{so.so_code}</span>
                          </div>
                          <div className="mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${so.status === 'Đã xuất kho' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-yellow-950 text-yellow-400 border border-yellow-800'}`}>{so.status}</span>
                          </div>
                          <p className="text-xs text-neutral-400">Ngày tạo: {so.order_date} • Kho: {so.warehouse}</p>
                          <p className="text-xs text-neutral-300 mt-1">Tổng số lượng đợt này: <strong className="text-orange-400">{totQty} SP</strong></p>
                          {so.status !== 'Đã xuất kho' ? (
                            <button onClick={() => setIssuingSO(so)} className="mt-3 w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 rounded-lg">Xuất kho cho SO này →</button>
                          ) : (
                            matchedGIN && <button onClick={() => setViewingGIN(matchedGIN)} className="mt-3 w-full bg-neutral-800 hover:bg-neutral-700 text-orange-400 text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5"><Eye size={14} /> Xem phiếu xuất</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Chưa có đợt giao hàng (Sales Order) nào thuộc PAKD này.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 4: DANH SÁCH SALES ORDERS --- */}
        {currentView === 'sales_orders' && (
          <div className="p-8 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-1">Danh sách Sales Orders (Đợt giao hàng)</h2>
            <p className="text-neutral-400 text-sm mb-6">Các yêu cầu giao hàng được tách ra từ Phương án kinh doanh</p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                    <th className="p-4">Mã SO</th>
                    <SortableDateHeader label="Ngày tạo" sortOrder={soDateSort} onToggle={setSoDateSort} />
                    <th className="p-4">Thuộc PAKD</th>
                    <th className="p-4">Khách hàng</th>
                    <th className="p-4 text-center">Tổng SL</th>
                    <th className="p-4 text-center">Trạng thái</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {sortedSalesOrders.length > 0 ? (
                    sortedSalesOrders.map((so) => {
                      const totQty = so.items.reduce((s, i) => s + Number(i.qty), 0);
                      const matchedGIN = goodsIssues.find((g) => g.so_code === so.so_code);
                      return (
                        <tr key={so.id} className="hover:bg-neutral-800/40">
                          <td className="p-4 font-mono font-bold text-white">{so.so_code}</td>
                          <td className="p-4 text-neutral-300 font-medium">{so.order_date}</td>
                          <td className="p-4 text-neutral-400 text-xs">{so.pakd_code}</td>
                          <td className="p-4 text-orange-400 font-semibold">{so.customer_name}</td>
                          <td className="p-4 text-center font-bold">{totQty}</td>
                          <td className="p-4 text-center">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${so.status === 'Đã xuất kho' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-yellow-950 text-yellow-400 border border-yellow-800'}`}>{so.status}</span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              {so.status !== 'Đã xuất kho' ? (
                                <button onClick={() => setIssuingSO(so)} className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Lập PXK</button>
                              ) : matchedGIN ? (
                                <button onClick={() => setViewingGIN(matchedGIN)} className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-orange-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold"><Eye size={13} /> Xem PXK</button>
                              ) : (
                                <span className="text-xs text-neutral-500 px-2.5 py-1.5">Hoàn tất</span>
                              )}
                              <button
                                onClick={() => setEditingSO(so)}
                                title="Sửa Sales Order"
                                className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-amber-600 text-amber-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Pencil size={13} /> Sửa
                              </button>
                              {so.status !== 'Đã xuất kho' && (
                                <button
                                  onClick={() => handleDeleteSO(so.id, so.so_code)}
                                  title="Xóa Sales Order"
                                  className="p-1.5 text-neutral-500 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-neutral-500 text-sm">
                        Chưa có Sales Order nào. Vào chi tiết một Phương án kinh doanh để tạo đợt giao hàng.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW 5: PHIẾU XUẤT KHO --- */}
        {currentView === 'outbound' && (
          <div className="p-8 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-1">Phiếu Xuất Kho (Outbound)</h2>
            <p className="text-neutral-400 text-sm mb-6">Lịch sử xuất kho thực tế theo từng Sales Order</p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                    <th className="p-4">Số Phiếu Xuất</th>
                    <th className="p-4">Mã SO tham chiếu</th>
                    <th className="p-4">Khách hàng</th>
                    <SortableDateHeader label="Ngày xuất" sortOrder={outboundDateSort} onToggle={setOutboundDateSort} />
                    <th className="p-4 text-right">Tổng SL xuất</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {sortedGoodsIssues.length > 0 ? (
                    sortedGoodsIssues.map((gin) => {
                      const totQty = gin.items.reduce((s, i) => s + Number(i.qty), 0);
                      return (
                        <tr key={gin.id} className="hover:bg-neutral-800/40">
                          <td className="p-4 font-mono font-bold text-orange-400">{gin.issue_code}</td>
                          <td className="p-4 font-mono text-white">{gin.so_code}</td>
                          <td className="p-4">{gin.customer_name}</td>
                          <td className="p-4 text-neutral-300 font-medium">{gin.date}</td>
                          <td className="p-4 text-right font-bold text-emerald-400">{totQty} SP</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => setViewingGIN(gin)}
                                className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Eye size={13} /> Xem
                              </button>
                              <button
                                onClick={() => setEditingGIN(gin)}
                                title="Sửa Phiếu xuất kho"
                                className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-amber-600 text-amber-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Pencil size={13} /> Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteGIN(gin.id, gin.issue_code, gin.so_code)}
                                title="Xóa Phiếu xuất kho"
                                className="p-1.5 text-neutral-500 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-neutral-500 text-sm">
                        Chưa có phiếu xuất kho nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW 6: KHÁCH HÀNG --- */}
        {currentView === 'customers' && (
          <div className="p-8 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-1">Danh sách Khách hàng</h2>
            <p className="text-neutral-400 text-sm mb-6">Tự động thêm mới khi tạo PAKD cho khách mới, hoặc cộng dồn cho khách cũ</p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                    <th className="p-4">Mã KH</th>
                    <th className="p-4">Tên khách hàng</th>
                    <th className="p-4">Tên công ty / Pháp nhân</th>
                    <th className="p-4 text-center">Số PAKD đã lập</th>
                    <th className="p-4 text-right">Tổng mua hàng (VNĐ)</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {customers.length > 0 ? (
                    customers.map((c) => (
                      <tr key={c.id} className="hover:bg-neutral-800/40">
                        <td className="p-4 font-mono font-bold text-orange-400">{c.id}</td>
                        <td className="p-4 font-bold text-white">{c.name}</td>
                        <td className="p-4 text-neutral-400">{c.company || '—'}</td>
                        <td className="p-4 text-center font-bold">{c.total_pakd}</td>
                        <td className="p-4 text-right font-semibold text-emerald-400">{getCustomerTotalAmount(c.id).toLocaleString()} đ</td>
                        <td className="p-4 text-center">
                          <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="p-1.5 text-neutral-500 hover:bg-red-900/50 hover:text-red-400 rounded-lg"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-neutral-500 text-sm">
                        Chưa có khách hàng nào. Hệ thống sẽ tự động thêm khách hàng khi bạn tạo Phương án kinh doanh.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW 7: TỒN KHO THỰC TẾ --- */}
        {currentView === 'inventory' && (
          <div className="p-8 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-1">Tồn Kho Thực Tế & Khả Dụng</h2>
            <p className="text-neutral-400 text-sm mb-6">Tự động lưu trữ SKU mới từ phiếu nhập kho, tăng khi nhập và trừ khi xuất</p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                    <th className="p-4">Brand</th>
                    <th className="p-4">Mã SKU</th>
                    <th className="p-4 w-2/5">Diễn giải / Tên sản phẩm</th>
                    <th className="p-4 text-center text-emerald-400">Tồn kho thực tế</th>
                    <th className="p-4 text-center text-yellow-400">Đang giữ cho SO chờ</th>
                    <th className="p-4 text-center text-orange-400">Tồn khả dụng</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {products.length > 0 ? (
                    products.map((prod) => {
                      const reserved = salesOrders.filter((s) => s.status !== 'Đã xuất kho').reduce((sum, s) => {
                        const found = s.items.find((i) => i.sku === prod.sku);
                        return sum + (found ? Number(found.qty) : 0);
                      }, 0);
                      const available = prod.stock - reserved;
                      return (
                        <tr key={prod.sku} className="hover:bg-neutral-800/40">
                          <td className="p-4"><span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400">{resolveItemBrand(prod, products)}</span></td>
                          <td className="p-4 font-mono font-semibold text-white">{prod.sku}</td>
                          <td className="p-4 text-neutral-300 leading-tight">{prod.name}</td>
                          <td className="p-4 text-center font-bold text-emerald-400">{prod.stock}</td>
                          <td className="p-4 text-center font-semibold text-yellow-400">{reserved}</td>
                          <td className="p-4 text-center font-bold text-orange-400">{available}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => setDeletingProduct(prod)}
                              title={`Xóa mã ${prod.sku} khỏi tồn kho`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-neutral-400 hover:text-red-400 hover:bg-red-950/60 border border-transparent hover:border-red-900/60 rounded-lg transition-colors"
                            >
                              <Trash2 size={15} /> Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-neutral-500 text-sm">
                        Kho đang trống. Hãy vào mục <strong className="text-orange-400">1. Nhập kho (Đầu vào)</strong> để nhập hàng và lưu danh mục SKU.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CÁC MODAL */}
        {deletingProduct && (
          <DeleteProductWarningModal
            product={deletingProduct}
            pakds={pakds}
            salesOrders={salesOrders}
            onClose={() => setDeletingProduct(null)}
            onConfirm={() => confirmDeleteProduct(deletingProduct)}
          />
        )}

        {showCustomerLeaderboard && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center">
                <div><h3 className="text-lg font-bold text-white">Xếp hạng Doanh số Khách hàng</h3><p className="text-xs text-neutral-400">Tính tổng theo giá trị cam kết trên các Phương án kinh doanh</p></div>
                <button onClick={() => setShowCustomerLeaderboard(false)} className="text-neutral-400 hover:text-white text-2xl">&times;</button>
              </div>
              <div className="p-6 overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-black/60 border-b border-neutral-800 text-xs uppercase text-neutral-400">
                      <th className="p-4 text-center w-16">Rank</th><th className="p-4">Khách hàng</th><th className="p-4 text-center">Số lượng PAKD</th><th className="p-4 text-right">Tổng doanh số (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {customers.length > 0 ? (
                      [...customers]
                        .sort((a, b) => getCustomerTotalAmount(b.id) - getCustomerTotalAmount(a.id))
                        .map((c, index) => (
                          <tr key={c.id} className="hover:bg-neutral-800/40">
                            <td className="p-4 text-center font-bold text-neutral-500">#{index + 1}</td>
                            <td className="p-4"><span className="font-bold text-orange-400">{c.name}</span><span className="text-xs text-neutral-400 block">{c.id}</span></td>
                            <td className="p-4 text-center font-bold text-white">{c.total_pakd}</td>
                            <td className="p-4 text-right font-bold text-emerald-400">{getCustomerTotalAmount(c.id).toLocaleString()} đ</td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-neutral-500 text-sm">
                          Chưa có dữ liệu doanh số khách hàng.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {(showCreatePAKD || editingPAKD) && (
          <PAKDFormModal
            initialPAKD={editingPAKD}
            customers={customers}
            products={products}
            salesOrders={salesOrders}
            getPAKDItemStats={getPAKDItemStats}
            onClose={() => {
              setShowCreatePAKD(false);
              setEditingPAKD(null);
            }}
            onSave={(pakdData, customerInfo) => {
              if (editingPAKD) {
                handleUpdatePAKD(editingPAKD, pakdData, customerInfo);
              } else {
                saveCheckpoint(`Tạo PAKD: ${pakdData.code}`);
                const existingIdx = customers.findIndex(
                  (c) => c.name.trim().toLowerCase() === customerInfo.name.trim().toLowerCase()
                );
                let updatedCustomers = [...customers];
                let custId = '';
                if (existingIdx >= 0) {
                  updatedCustomers[existingIdx] = {
                    ...updatedCustomers[existingIdx],
                    total_pakd: updatedCustomers[existingIdx].total_pakd + 1,
                  };
                  custId = updatedCustomers[existingIdx].id;
                  notify(`Đã lưu PAKD cho khách hàng cũ: ${updatedCustomers[existingIdx].name}`);
                } else {
                  custId = `KH-00${customers.length + 1}`;
                  updatedCustomers.push({
                    id: custId,
                    name: customerInfo.name.trim(),
                    company: customerInfo.company.trim(),
                    region: customerInfo.region || 'Hồ Chí Minh',
                    total_pakd: 1,
                  });
                  notify(`Đã tự động thêm khách hàng mới: ${customerInfo.name.trim()}`);
                }
                setCustomers(updatedCustomers);
                setPakds([{ ...pakdData, customer_id: custId }, ...pakds]);
                setShowCreatePAKD(false);
              }
            }}
          />
        )}

        {(showCreateSO || editingSO) && (
          <SOFormModal
            initialSO={editingSO}
            pakd={
              editingSO
                ? pakds.find((p) => p.id === editingSO.pakd_id) || {
                    id: editingSO.pakd_id,
                    code: editingSO.pakd_code,
                    customer_name: editingSO.customer_name,
                    items: editingSO.items.map((i) => ({ ...i, total_qty: i.qty })),
                  }
                : selectedPAKD
            }
            getPAKDItemStats={getPAKDItemStats}
            onClose={() => {
              setShowCreateSO(false);
              setEditingSO(null);
            }}
            onSave={(soData) => {
              if (editingSO) {
                handleUpdateSO(editingSO, soData);
              } else {
                saveCheckpoint(`Tạo Sales Order: ${soData.so_code}`);
                setSalesOrders([soData, ...salesOrders]);
                setShowCreateSO(false);
                notify(`Đã tạo Sales Order: ${soData.so_code}`);
              }
            }}
          />
        )}

        {(showCreateGRN || editingGRN) && (
          <GRNFormModal
            initialGRN={editingGRN}
            products={products}
            goodsReceipts={goodsReceipts}
            pakds={pakds}
            onClose={() => {
              setShowCreateGRN(false);
              setEditingGRN(null);
            }}
            onSave={(grnData) => {
              if (editingGRN) {
                handleUpdateGRN(editingGRN, grnData);
              } else {
                saveCheckpoint(`Nhập kho: ${grnData.receipt_code}`);
                let updatedProducts = [...products];
                let newSkusCount = 0;

                grnData.items.forEach((line) => {
                  const cleanSku = line.sku.trim().toUpperCase();
                  const cleanDesc = (line.name || '').trim() || cleanSku;
                  const cleanBrand =
                    (line.brand || '').trim().toUpperCase() ||
                    resolveItemBrand({ sku: cleanSku, name: cleanDesc }, updatedProducts);
                  const importPrice = Number(line.import_price) || 0;
                  const qty = Number(line.qty) || 0;

                  const idx = updatedProducts.findIndex(
                    (p) => p.sku.trim().toLowerCase() === cleanSku.toLowerCase()
                  );
                  if (idx >= 0) {
                    const prevDescs = Array.isArray(updatedProducts[idx].descriptions)
                      ? updatedProducts[idx].descriptions
                      : [updatedProducts[idx].name].filter(Boolean);
                    const mergedDescs = prevDescs.some((d) => d.toLowerCase() === cleanDesc.toLowerCase())
                      ? prevDescs
                      : [cleanDesc, ...prevDescs];

                    updatedProducts[idx] = {
                      ...updatedProducts[idx],
                      brand: cleanBrand !== 'KHÁC' ? cleanBrand : updatedProducts[idx].brand,
                      name: cleanDesc,
                      descriptions: mergedDescs,
                      cost: importPrice > 0 ? importPrice : updatedProducts[idx].cost,
                      stock: Number(updatedProducts[idx].stock) + qty,
                    };
                  } else {
                    newSkusCount += 1;
                    updatedProducts.push({
                      sku: cleanSku,
                      brand: cleanBrand,
                      name: cleanDesc,
                      descriptions: [cleanDesc],
                      unit: 'pcs',
                      cost: importPrice,
                      price: Math.round(importPrice * 1.3),
                      stock: qty,
                    });
                  }
                });

                const normalizedGRN = {
                  ...grnData,
                  items: grnData.items.map((line) => ({
                    ...line,
                    sku: line.sku.trim().toUpperCase(),
                    brand:
                      (line.brand || '').trim().toUpperCase() ||
                      resolveItemBrand(line, updatedProducts),
                    name: (line.name || '').trim() || line.sku.trim().toUpperCase(),
                  })),
                };

                setProducts(updatedProducts);
                setGoodsReceipts([normalizedGRN, ...goodsReceipts]);
                setShowCreateGRN(false);
                notify(
                  newSkusCount > 0
                    ? `Đã nhập kho ${normalizedGRN.receipt_code} & tự động lưu ${newSkusCount} SKU mới!`
                    : `Đã nhập kho ${normalizedGRN.receipt_code} & cập nhật tồn kho!`
                );
              }
            }}
          />
        )}

        {issuingSO && (
          <CreateGINModal
            so={issuingSO}
            onClose={() => setIssuingSO(null)}
            onSave={(newGIN) => {
              saveCheckpoint(`Xuất kho: ${newGIN.issue_code}`);
              const updatedProducts = products.map((p) => {
                const issuedLine = newGIN.items.find((i) => i.sku.toLowerCase() === p.sku.toLowerCase());
                if (issuedLine) {
                  return { ...p, stock: Math.max(0, Number(p.stock) - Number(issuedLine.qty)) };
                }
                return p;
              });
              setProducts(updatedProducts);
              setSalesOrders(salesOrders.map((s) => (s.id === issuingSO.id ? { ...s, status: 'Đã xuất kho' } : s)));
              setGoodsIssues([newGIN, ...goodsIssues]);
              setIssuingSO(null);
              notify(`Đã xuất kho ${newGIN.issue_code} và trừ tồn kho thành công!`);
            }}
          />
        )}

        {editingGIN && (
          <EditGINModal
            gin={editingGIN}
            onClose={() => setEditingGIN(null)}
            onSave={(updatedGIN) => handleUpdateGIN(editingGIN, updatedGIN)}
          />
        )}

        {viewingGRN && (
          <GRNDetailModal
            grn={viewingGRN}
            products={products}
            onClose={() => setViewingGRN(null)}
            onEdit={() => {
              const target = viewingGRN;
              setViewingGRN(null);
              setEditingGRN(target);
            }}
          />
        )}

        {viewingGIN && (
          <GINDetailModal
            gin={viewingGIN}
            onClose={() => setViewingGIN(null)}
            onEdit={() => {
              const target = viewingGIN;
              setViewingGIN(null);
              setEditingGIN(target);
            }}
          />
        )}
      </main>
    </div>
  );
}

// --- MODAL CẢNH BÁO KHI XÓA MÃ SKU TRÊN TỒN KHO THỰC TẾ ---
function DeleteProductWarningModal({ product, pakds, salesOrders, onClose, onConfirm }) {
  const linkedPAKDs = pakds.filter((p) => (p.items || []).some((i) => i.sku === product.sku));
  const pendingSOs = salesOrders.filter(
    (so) => so.status !== 'Đã xuất kho' && (so.items || []).some((i) => i.sku === product.sku)
  );
  const reservedQty = pendingSOs.reduce((sum, so) => {
    const line = so.items.find((i) => i.sku === product.sku);
    return sum + (line ? Number(line.qty) : 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-red-500/60 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 bg-red-950/60 border-b border-red-900/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cảnh báo xóa mã hàng khỏi Tồn kho</h3>
            <p className="text-xs text-red-300 mt-0.5">Hành động này sẽ xóa mã SKU khỏi danh mục tồn kho thực tế</p>
          </div>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <div className="bg-black/50 border border-neutral-800 rounded-xl p-4 space-y-1.5">
            <p className="text-xs text-neutral-400">Mã SKU chuẩn bị xóa:</p>
            <p className="font-mono font-bold text-orange-400 text-base">{product.sku}</p>
            <p className="text-xs text-neutral-300 leading-snug">{product.name}</p>
            <div className="pt-2 mt-2 border-t border-neutral-800 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Tồn kho thực tế hiện tại:</span>
              <span className={`font-bold ${Number(product.stock) > 0 ? 'text-amber-400' : 'text-neutral-300'}`}>
                {Number(product.stock)} SP
              </span>
            </div>
          </div>

          {(Number(product.stock) > 0 || linkedPAKDs.length > 0 || pendingSOs.length > 0) && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-200">
              <p className="font-bold text-amber-400 flex items-center gap-1.5">
                <AlertCircle size={14} /> Lưu ý quan trọng trước khi xác nhận:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-200/90">
                {Number(product.stock) > 0 && (
                  <li>
                    Mã này vẫn còn <strong>{product.stock} SP</strong> tồn kho thực tế. Xóa sẽ làm mất số liệu tồn trên bảng kho.
                  </li>
                )}
                {pendingSOs.length > 0 && (
                  <li>
                    Đang có <strong>{pendingSOs.length} Sales Order chờ xuất</strong> giữ <strong>{reservedQty} SP</strong> của mã này.
                  </li>
                )}
                {linkedPAKDs.length > 0 && (
                  <li>
                    Mã này đang xuất hiện trong <strong>{linkedPAKDs.length} Phương án kinh doanh</strong> (các phiếu cũ vẫn giữ nguyên, nhưng không thể chọn lại mã này khi tạo PAKD mới).
                  </li>
                )}
              </ul>
            </div>
          )}

          <p className="text-xs text-neutral-400">
            Bạn có chắc chắn muốn xóa mã <strong className="text-white font-mono">{product.sku}</strong> không?
          </p>
        </div>

        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 shadow-lg shadow-red-950"
          >
            <Trash2 size={15} /> Xác nhận xóa mã SKU
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODAL TẠO & CHỈNH SỬA PHƯƠNG ÁN KINH DOANH ---
function PAKDFormModal({ initialPAKD, customers, products, getPAKDItemStats, onClose, onSave }) {
  const isEdit = Boolean(initialPAKD);
  const existingCust = initialPAKD
    ? customers.find((c) => c.id === initialPAKD.customer_id)
    : null;

  const [code, setCode] = useState(initialPAKD?.code || '');
  const [customerName, setCustomerName] = useState(initialPAKD?.customer_name || '');
  const [company, setCompany] = useState(existingCust?.company || '');
  const [region, setRegion] = useState(initialPAKD?.region || existingCust?.region || 'Hồ Chí Minh');
  const [date, setDate] = useState(initialPAKD?.date || new Date().toLocaleDateString('vi-VN'));
  const [lines, setLines] = useState(
    initialPAKD?.items?.length > 0
      ? initialPAKD.items.map((i) => ({ ...i }))
      : [{ sku: '', name: '', cost: 0, price: 0, total_qty: 1 }]
  );

  const productOptions = products.map((p) => ({
    value: p.sku,
    brand: resolveItemBrand(p, products),
    label: p.name,
  }));
  const matchedCustomer =
    customerName.trim().length >= 2
      ? customers.find((c) => c.name.toLowerCase().includes(customerName.trim().toLowerCase()))
      : null;

  const handleSelectProduct = (idx, sku) => {
    const prod = products.find((p) => p.sku === sku);
    const updated = [...lines];
    updated[idx] = {
      ...updated[idx],
      sku,
      name: prod ? prod.name : '',
      cost: prod ? prod.cost : 0,
      price: prod ? prod.price : 0,
    };
    setLines(updated);
  };

  const handleSubmit = () => {
    if (!code.trim() || !customerName.trim()) {
      return alert('Vui lòng nhập Số PAKD và Tên khách hàng!');
    }
    const validLines = lines.filter((l) => l.sku && Number(l.total_qty) > 0);
    if (validLines.length === 0) {
      return alert('Vui lòng chọn ít nhất 1 sản phẩm có số lượng lớn hơn 0!');
    }

    if (isEdit && initialPAKD) {
      for (const oldItem of initialPAKD.items) {
        const { shipped, pending } = getPAKDItemStats(initialPAKD.id, oldItem.sku);
        const committed = shipped + pending;
        if (committed > 0) {
          const matchingNewLines = validLines.filter((l) => l.sku === oldItem.sku);
          const newTotalQty = matchingNewLines.reduce((s, l) => s + Number(l.total_qty), 0);
          if (newTotalQty < committed) {
            return alert(
              `Mã SKU ${oldItem.sku} đã gọi tổng cộng ${committed} SP trong các Sales Order. Số lượng cam kết mới không được nhỏ hơn ${committed} SP!`
            );
          }
        }
      }
    }

    onSave(
      {
        id: initialPAKD?.id || 'PAKD-' + Date.now(),
        code: code.trim(),
        customer_name: customerName.trim(),
        region,
        date: date.trim() || new Date().toLocaleDateString('vi-VN'),
        status: initialPAKD?.status || 'Đang thực hiện',
        items: validLines,
      },
      { name: customerName, company, region }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">
              {isEdit ? 'Chỉnh Sửa Phương Án Kinh Doanh' : 'Tạo Phương Án Kinh Doanh Mới'}
            </h3>
            {isEdit && (
              <p className="text-xs text-amber-400 mt-0.5">Đang chỉnh sửa: {initialPAKD.code}</p>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Số Phương án kinh doanh *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: PAKD.1126-T1002-BIDA99"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-white text-sm focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Ngày lập (DD/MM/YYYY)</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-white text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 bg-black/40 p-4 rounded-xl border border-neutral-800">
            <div className="relative">
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Tên Khách hàng *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên khách hàng..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-white text-sm focus:border-orange-500 outline-none"
              />
              {matchedCustomer &&
                matchedCustomer.name.toLowerCase() !== customerName.trim().toLowerCase() && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerName(matchedCustomer.name);
                      setCompany(matchedCustomer.company || '');
                      setRegion(matchedCustomer.region || 'Hồ Chí Minh');
                    }}
                    className="mt-1 w-full text-left bg-neutral-800 hover:bg-neutral-700 p-2 rounded text-xs text-orange-400"
                  >
                    Chọn khách cũ: <strong>{matchedCustomer.name}</strong> ({matchedCustomer.id})
                  </button>
                )}
              {customerName.trim().length > 1 &&
                !customers.some((c) => c.name.toLowerCase() === customerName.trim().toLowerCase()) && (
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> Khách mới: sẽ tự động thêm vào danh sách KH
                  </p>
                )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Pháp nhân / Công ty</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Tên công ty / Hộ KD"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Khu vực</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-white text-sm"
              >
                <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                <option value="Hà Nội">Hà Nội</option>
                <option value="Đà Nẵng">Đà Nẵng</option>
                <option value="Tỉnh khác">Tỉnh khác</option>
              </select>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase text-neutral-400">Chi tiết hàng hóa cam kết</span>
              <button
                type="button"
                onClick={() =>
                  setLines([...lines, { sku: '', name: '', cost: 0, price: 0, total_qty: 1 }])
                }
                className="text-xs bg-neutral-800 hover:bg-neutral-700 text-orange-400 px-3 py-1.5 rounded-lg font-semibold"
              >
                + Thêm dòng hàng
              </button>
            </div>
            <div className="space-y-2.5">
              {lines.map((line, idx) => {
                const committedStats =
                  isEdit && line.sku
                    ? getPAKDItemStats(initialPAKD.id, line.sku)
                    : { shipped: 0, pending: 0 };
                const committedQty = committedStats.shipped + committedStats.pending;

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2.5 items-end bg-neutral-950 p-3 rounded-lg border border-neutral-800"
                  >
                    <div className="col-span-6">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-neutral-400">
                          Mã SKU / Tên hàng hóa *
                        </label>
                        {committedQty > 0 && (
                          <span className="text-[10px] text-amber-400 font-medium">
                            Đã gọi SO: {committedQty} SP
                          </span>
                        )}
                      </div>
                      <SearchableSelect
                        options={productOptions}
                        value={line.sku}
                        onChange={(sku) => handleSelectProduct(idx, sku)}
                        placeholder="Chọn hoặc tìm kiếm mã SKU / tên sản phẩm..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1 text-center">
                        Số lượng *
                      </label>
                      <input
                        type="number"
                        min={committedQty > 0 ? committedQty : 1}
                        value={line.total_qty}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].total_qty = Number(e.target.value);
                          setLines(updated);
                        }}
                        placeholder="SL"
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white text-center font-bold outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1 text-right">
                        Đơn giá bán (gồm VAT)
                      </label>
                      <input
                        type="number"
                        value={line.price}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].price = Number(e.target.value);
                          setLines(updated);
                        }}
                        placeholder="Đơn giá bán (gồm VAT)"
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white text-right outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pb-1">
                      {lines.length > 1 && committedQty === 0 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          title="Xóa dòng hàng"
                          className="text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-bold"
          >
            {isEdit ? 'CẬP NHẬT PHƯƠNG ÁN' : 'LƯU PHƯƠNG ÁN'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODAL TẠO & CHỈNH SỬA SALES ORDER ---
function SOFormModal({ initialSO, pakd, getPAKDItemStats, onClose, onSave }) {
  const isEdit = Boolean(initialSO);

  const [soCode, setSoCode] = useState(initialSO?.so_code || '');
  const [warehouse, setWarehouse] = useState(initialSO?.warehouse || 'Hà Nội');
  const [orderDate, setOrderDate] = useState(
    initialSO?.order_date || new Date().toLocaleDateString('vi-VN')
  );
  const [deliveryDate, setDeliveryDate] = useState(
    initialSO?.delivery_date || new Date().toISOString().split('T')[0]
  );
  const [quantities, setQuantities] = useState(() => {
    if (!initialSO) return {};
    const map = {};
    initialSO.items.forEach((item) => {
      map[item.sku] = item.qty;
    });
    return map;
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = () => {
    if (!soCode.trim()) return alert('Vui lòng tự nhập Mã Sales Order (SO No.)!');
    const orderItems = [];
    pakd.items.forEach((item) => {
      const qty = Number(quantities[item.sku] || 0);
      if (qty > 0) orderItems.push({ sku: item.sku, name: item.name, price: item.price, qty });
    });
    if (orderItems.length === 0) return alert('Vui lòng nhập số lượng cho ít nhất 1 mặt hàng!');

    onSave({
      id: initialSO?.id || 'SO-' + Date.now(),
      so_code: soCode.trim(),
      pakd_id: pakd.id,
      pakd_code: pakd.code,
      customer_name: pakd.customer_name,
      order_date: orderDate.trim() || new Date().toLocaleDateString('vi-VN'),
      delivery_date: deliveryDate,
      warehouse,
      status: initialSO?.status || 'Chờ xuất kho',
      items: orderItems,
    });
  };

  const filteredItems = pakd.items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">
              {isEdit ? 'Chỉnh Sửa Sales Order' : 'Tạo Sales Order (Đợt giao hàng mới)'}
            </h3>
            <p className="text-xs text-neutral-400">
              Tham chiếu: {pakd.code} • Khách hàng: {pakd.customer_name}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isEdit && initialSO.status === 'Đã xuất kho' && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <span>
                Đơn hàng này <strong>Đã xuất kho</strong>. Khi cập nhật, hệ thống sẽ tự động đồng bộ lại Phiếu xuất kho liên quan và Tồn kho thực tế.
              </span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 bg-black/40 p-4 rounded-xl border border-neutral-800">
            <div>
              <label className="block text-xs font-bold text-orange-400 mb-1">
                Số Sales Order (Tự đặt) *
              </label>
              <input
                type="text"
                value={soCode}
                onChange={(e) => setSoCode(e.target.value)}
                placeholder="VD: SO.0926-T1005"
                className="w-full bg-neutral-950 border border-orange-500/60 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-orange-500 outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Ngày tạo SO</label>
              <input
                type="text"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Kho xuất hàng</label>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="Hà Nội">Hà Nội</option>
                <option value="Hồ Chí Minh">Hồ Chí Minh</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Ngày dự kiến giao</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          <div>
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
              <input
                type="text"
                placeholder="Tìm kiếm tên hàng hóa hoặc mã SKU trong phương án này..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-white text-sm outline-none focus:border-orange-500"
              />
            </div>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-black/60 text-xs uppercase text-neutral-400">
                  <th className="p-3 w-3/5">Sản phẩm (Hiển thị đầy đủ)</th>
                  <th className="p-3 text-center">SL Tối đa được gọi</th>
                  <th className="p-3 text-center">SL Gọi đợt này</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredItems.map((item) => {
                  const { shipped, pending } = getPAKDItemStats(
                    pakd.id,
                    item.sku,
                    isEdit ? initialSO.id : null
                  );
                  const maxAllowed = item.total_qty - shipped - pending;
                  if (maxAllowed <= 0 && !quantities[item.sku]) return null;
                  return (
                    <tr key={item.sku}>
                      <td className="p-3">
                        <p className="font-mono font-semibold text-orange-400 text-xs">{item.sku}</p>
                        <p className="text-sm text-white leading-snug mt-0.5">{item.name}</p>
                      </td>
                      <td className="p-3 text-center font-bold text-orange-400">{Math.max(0, maxAllowed)}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={Math.max(0, maxAllowed)}
                          value={quantities[item.sku] ?? ''}
                          onChange={(e) => {
                            let val = parseInt(e.target.value, 10) || 0;
                            if (val < 0) val = 0;
                            if (val > maxAllowed) val = Math.max(0, maxAllowed);
                            setQuantities({ ...quantities, [item.sku]: val });
                          }}
                          placeholder="0"
                          className="w-24 text-center bg-neutral-950 border border-neutral-700 rounded-lg py-1.5 text-white font-bold focus:border-orange-500 outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <p className="text-center text-neutral-500 py-4 text-sm">Không tìm thấy mặt hàng nào phù hợp.</p>
            )}
          </div>
        </div>
        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-bold"
          >
            {isEdit ? 'CẬP NHẬT SALES ORDER' : 'XÁC NHẬN TẠO SO'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODAL TẠO & CHỈNH SỬA PHIẾU NHẬP KHO ---
function GRNFormModal({ initialGRN, products, goodsReceipts, pakds, onClose, onSave }) {
  const isEdit = Boolean(initialGRN);

  const [receiptCode, setReceiptCode] = useState(initialGRN?.receipt_code || '');
  const [supplier, setSupplier] = useState(initialGRN?.supplier || '');
  const [warehouse, setWarehouse] = useState(initialGRN?.warehouse || 'Hà Nội');
  const [date, setDate] = useState(initialGRN?.date || new Date().toLocaleDateString('vi-VN'));
  const [lines, setLines] = useState(() => {
    if (initialGRN?.items?.length > 0) {
      return initialGRN.items.map((item) => ({
        sku: item.sku || '',
        brand: item.brand || resolveItemBrand(item, products),
        name: item.name || '',
        qty: Number(item.qty) || 1,
        import_price: item.import_price ?? '',
        nameTouched: true,
        brandTouched: true,
      }));
    }
    return [{ sku: '', brand: '', name: '', qty: 1, import_price: '', nameTouched: false, brandTouched: false }];
  });
  const [activeSkuRow, setActiveSkuRow] = useState(null);

  const updateLine = (idx, updater) => {
    setLines((prev) => prev.map((item, i) => (i === idx ? updater(item) : item)));
  };

  const handleSkuInputChange = (idx, rawValue) => {
    const cleanCheck = rawValue.trim().toLowerCase();
    const matchedProd = cleanCheck
      ? products.find((p) => p.sku.trim().toLowerCase() === cleanCheck)
      : null;
    const oldDescs = getHistoricalDescriptionsForSKU(rawValue, products, goodsReceipts, pakds);

    updateLine(idx, (line) => {
      const next = { ...line, sku: rawValue };
      if (matchedProd) {
        if (!line.brandTouched) {
          next.brand = resolveItemBrand(matchedProd, products);
        }
        if (!line.nameTouched && oldDescs.length > 0) {
          next.name = oldDescs[0];
        }
        if (!line.import_price) {
          next.import_price = matchedProd.cost || '';
        }
      } else {
        if (!line.brandTouched) {
          const detected = resolveItemBrand({ sku: rawValue, name: line.name }, products);
          next.brand = detected !== 'KHÁC' ? detected : '';
        }
        if (!line.nameTouched && oldDescs.length > 0) {
          next.name = oldDescs[0];
        }
      }
      return next;
    });
    setActiveSkuRow(idx);
  };

  const handleSelectExistingSku = (idx, prod) => {
    const oldDescs = getHistoricalDescriptionsForSKU(prod.sku, products, goodsReceipts, pakds);
    updateLine(idx, (line) => ({
      ...line,
      sku: prod.sku,
      brand: resolveItemBrand(prod, products),
      name: oldDescs[0] || prod.name || '',
      import_price: prod.cost || line.import_price,
      nameTouched: false,
      brandTouched: false,
    }));
    setActiveSkuRow(null);
  };

  const handleDescInputChange = (idx, val) => {
    updateLine(idx, (line) => {
      const next = { ...line, name: val, nameTouched: val.trim().length > 0 };
      if (!line.brandTouched) {
        const detected = resolveItemBrand({ sku: line.sku, name: val }, products);
        if (detected !== 'KHÁC') next.brand = detected;
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!receiptCode.trim() || !supplier.trim()) {
      return alert('Vui lòng nhập Số phiếu nhập và Nhà cung cấp!');
    }
    const validLines = lines.filter((l) => l.sku.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) {
      return alert('Vui lòng nhập ít nhất 1 mã SKU và số lượng lớn hơn 0!');
    }
    const missingDesc = validLines.find((l) => !l.name.trim());
    if (missingDesc) {
      return alert(`Vui lòng nhập diễn giải hàng hóa cho mã SKU: ${missingDesc.sku}`);
    }

    onSave({
      id: initialGRN?.id || 'PNK-' + Date.now(),
      receipt_code: receiptCode.trim(),
      supplier: supplier.trim(),
      warehouse,
      date: date.trim() || new Date().toLocaleDateString('vi-VN'),
      items: validLines.map(({ nameTouched, brandTouched, ...rest }) => ({
        ...rest,
        sku: rest.sku.trim().toUpperCase(),
        name: rest.name.trim(),
        brand: (rest.brand || '').trim().toUpperCase(),
        qty: Number(rest.qty),
        import_price: Number(rest.import_price) || 0,
      })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">
              {isEdit ? 'Chỉnh Sửa Phiếu Nhập Kho Đầu Vào' : 'Tạo Phiếu Nhập Kho Đầu Vào'}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {isEdit
                ? `Đang chỉnh sửa phiếu ${initialGRN.receipt_code} — Tồn kho sẽ tự động tính lại sau khi cập nhật`
                : 'Tự nhập mã SKU mới (hệ thống tự lưu) hoặc nhập SKU cũ để nhận gợi ý diễn giải trước đây'}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Số Phiếu nhập kho *</label>
              <input
                type="text"
                value={receiptCode}
                onChange={(e) => setReceiptCode(e.target.value)}
                placeholder="VD: PNK.1126-005"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-orange-500 outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Ngày nhập kho</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Nhà cung cấp *</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Tên NCC..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Kho nhập</label>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="Hà Nội">Hà Nội</option>
                <option value="Hồ Chí Minh">Hồ Chí Minh</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-neutral-400">Chi tiết hàng hóa nhập kho</span>
              <button
                type="button"
                onClick={() =>
                  setLines([
                    ...lines,
                    { sku: '', brand: '', name: '', qty: 1, import_price: '', nameTouched: false, brandTouched: false },
                  ])
                }
                className="text-xs bg-neutral-800 hover:bg-orange-600 text-orange-400 hover:text-white px-3.5 py-1.5 rounded-lg font-semibold transition-colors"
              >
                + Thêm dòng hàng
              </button>
            </div>

            {lines.map((line, idx) => {
              const skuTrim = line.sku.trim();
              const isExistingSku = skuTrim
                ? products.some((p) => p.sku.trim().toLowerCase() === skuTrim.toLowerCase())
                : false;
              const historicalDescriptions = getHistoricalDescriptionsForSKU(skuTrim, products, goodsReceipts, pakds);

              const matchingSkus = skuTrim
                ? products.filter(
                    (p) =>
                      p.sku.toLowerCase().includes(skuTrim.toLowerCase()) ||
                      p.name.toLowerCase().includes(skuTrim.toLowerCase())
                  )
                : products;

              return (
                <div
                  key={idx}
                  className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3 relative"
                >
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5 relative">
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                        Mã SKU (Tự nhập hoặc chọn) *
                      </label>
                      <input
                        type="text"
                        value={line.sku}
                        onFocus={() => setActiveSkuRow(idx)}
                        onChange={(e) => handleSkuInputChange(idx, e.target.value)}
                        placeholder="Nhập mã SKU mới hoặc gõ tìm..."
                        className="w-full bg-neutral-900 border border-neutral-700 focus:border-orange-500 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase outline-none"
                      />

                      {activeSkuRow === idx && matchingSkus.length > 0 && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setActiveSkuRow(null)}
                          />
                          <div className="absolute left-0 right-0 z-40 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-2xl max-h-56 overflow-y-auto p-1">
                            <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-neutral-400 border-b border-neutral-700">
                              SKU đã lưu trên hệ thống (Bấm chọn hoặc tiếp tục gõ SKU mới)
                            </div>
                            {matchingSkus.map((prod) => (
                              <button
                                key={prod.sku}
                                type="button"
                                onClick={() => handleSelectExistingSku(idx, prod)}
                                className="w-full text-left px-2.5 py-2 rounded hover:bg-orange-600 text-neutral-200 hover:text-white transition-colors block"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-bold text-xs">{prod.sku}</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-orange-300">
                                    {resolveItemBrand(prod, products)}
                                  </span>
                                </div>
                                <p className="text-[11px] opacity-90 leading-snug mt-0.5">{prod.name}</p>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Brand</label>
                      <input
                        type="text"
                        value={line.brand}
                        onChange={(e) =>
                          updateLine(idx, (l) => ({
                            ...l,
                            brand: e.target.value.toUpperCase(),
                            brandTouched: true,
                          }))
                        }
                        placeholder="VD: PREDATOR"
                        className="w-full bg-neutral-900 border border-neutral-700 focus:border-orange-500 rounded-lg px-2.5 py-2 text-xs text-orange-400 text-center font-bold uppercase outline-none"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">SL nhập *</label>
                      <input
                        type="number"
                        min="1"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(idx, (l) => ({ ...l, qty: Number(e.target.value) }))
                        }
                        className="w-full bg-neutral-900 border border-neutral-700 focus:border-orange-500 rounded-lg px-2.5 py-2 text-xs text-white text-center font-bold outline-none"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Đơn giá nhập (VND)</label>
                      <input
                        type="number"
                        min="0"
                        value={line.import_price}
                        onChange={(e) =>
                          updateLine(idx, (l) => ({ ...l, import_price: e.target.value }))
                        }
                        placeholder="0"
                        className="w-full bg-neutral-900 border border-neutral-700 focus:border-orange-500 rounded-lg px-2.5 py-2 text-xs text-white text-right outline-none"
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pb-1">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          title="Xóa dòng này"
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-neutral-400">
                        Diễn giải / Tên hàng hóa chi tiết *
                      </label>
                      {skuTrim && (
                        isExistingSku ? (
                          <span className="text-[11px] text-orange-400 font-medium">
                            SKU đã có trong hệ thống
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1 font-medium">
                            <Sparkles size={12} /> SKU mới — sẽ tự động lưu trữ khi hoàn tất
                          </span>
                        )
                      )}
                    </div>

                    <input
                      type="text"
                      value={line.name}
                      onChange={(e) => handleDescInputChange(idx, e.target.value)}
                      placeholder="Nhập diễn giải hàng hóa (VD: Chuôi cơ BCP PRE..., Hiệu : PREDATOR, Mới 100%)"
                      className="w-full bg-neutral-900 border border-neutral-700 focus:border-orange-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                    />

                    {historicalDescriptions.length > 0 && (
                      <div className="mt-2 bg-black/50 border border-orange-500/30 rounded-lg p-2.5 space-y-1.5">
                        <p className="text-[11px] font-semibold text-orange-400">
                          Gợi ý diễn giải cũ của mã <span className="font-mono">{skuTrim.toUpperCase()}</span> (bấm để áp dụng):
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {historicalDescriptions.map((desc, dIdx) => {
                            const isSelected = line.name.trim().toLowerCase() === desc.toLowerCase();
                            return (
                              <button
                                key={dIdx}
                                type="button"
                                onClick={() =>
                                  updateLine(idx, (l) => ({
                                    ...l,
                                    name: desc,
                                    nameTouched: true,
                                    brand: l.brandTouched
                                      ? l.brand
                                      : resolveItemBrand({ sku: l.sku, name: desc }, products),
                                  }))
                                }
                                className={`text-left text-xs px-3 py-1.5 rounded-md border transition-colors leading-snug ${
                                  isSelected
                                    ? 'bg-orange-600/20 border-orange-500 text-orange-200 font-medium'
                                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                                }`}
                              >
                                {desc}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-orange-950"
          >
            {isEdit ? 'CẬP NHẬT PHIẾU NHẬP KHO' : 'HOÀN TẤT NHẬP KHO'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODAL LẬP PHIẾU XUẤT KHO ---
function CreateGINModal({ so, onClose, onSave }) {
  const [issueCode, setIssueCode] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('vi-VN'));

  const handleSubmit = () => {
    if (!issueCode.trim()) return alert('Vui lòng nhập Số Phiếu xuất kho!');
    onSave({
      id: 'PXK-' + Date.now(),
      issue_code: issueCode.trim(),
      so_code: so.so_code,
      pakd_code: so.pakd_code,
      customer_name: so.customer_name,
      warehouse: so.warehouse,
      date: issueDate.trim() || new Date().toLocaleDateString('vi-VN'),
      items: so.items,
    });
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white">Xác Nhận Xuất Kho</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="bg-black/40 p-4 rounded-xl border border-neutral-800 space-y-2 text-sm">
            <p>
              Số SO: <strong className="text-orange-400 font-mono">{so.so_code}</strong>
            </p>
            <p>
              Khách hàng: <strong className="text-white">{so.customer_name}</strong> • Kho:{' '}
              <strong>{so.warehouse}</strong>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-orange-400 mb-1">Số PXK *</label>
              <input
                type="text"
                value={issueCode}
                onChange={(e) => setIssueCode(e.target.value)}
                placeholder="VD: PXK.1126-008"
                className="w-full bg-neutral-950 border border-orange-500/60 rounded-lg px-3.5 py-2 text-white text-sm font-mono outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Ngày xuất kho</label>
              <input
                type="text"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-white text-sm"
              />
            </div>
          </div>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-black/60 text-xs uppercase text-neutral-400">
                <th className="p-3">Mã SKU</th>
                <th className="p-3">Tên hàng hóa</th>
                <th className="p-3 text-center">SL Thực xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {so.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-mono text-white">{item.sku}</td>
                  <td className="p-3 text-neutral-300 leading-tight">{item.name}</td>
                  <td className="p-3 text-center font-bold text-emerald-400">{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-bold"
          >
            XÁC NHẬN XUẤT KHO
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODAL CHỈNH SỬA PHIẾU XUẤT KHO ---
function EditGINModal({ gin, onClose, onSave }) {
  const [issueCode, setIssueCode] = useState(gin.issue_code || '');
  const [issueDate, setIssueDate] = useState(gin.date || new Date().toLocaleDateString('vi-VN'));
  const [warehouse, setWarehouse] = useState(gin.warehouse || 'Hà Nội');
  const [items, setItems] = useState(gin.items.map((i) => ({ ...i })));

  const handleSubmit = () => {
    if (!issueCode.trim()) return alert('Vui lòng nhập Số Phiếu xuất kho!');
    const validItems = items.filter((i) => Number(i.qty) > 0);
    if (validItems.length === 0) {
      return alert('Phiếu xuất kho phải có ít nhất 1 sản phẩm có số lượng lớn hơn 0!');
    }

    onSave({
      ...gin,
      issue_code: issueCode.trim(),
      date: issueDate.trim() || gin.date,
      warehouse,
      items: validItems.map((i) => ({ ...i, qty: Number(i.qty) })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center shrink-0">
          <div>
            <span className="text-xs uppercase font-bold text-amber-400">Chỉnh sửa Phiếu Xuất Kho</span>
            <h3 className="text-lg font-bold text-white font-mono mt-0.5">{gin.issue_code}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="bg-black/40 p-3.5 rounded-xl border border-neutral-800 text-xs text-neutral-300 flex flex-wrap gap-x-6 gap-y-1">
            <span>
              SO tham chiếu: <strong className="text-orange-400 font-mono">{gin.so_code}</strong>
            </span>
            <span>
              PAKD: <strong className="text-white font-mono">{gin.pakd_code || '—'}</strong>
            </span>
            <span>
              Khách hàng: <strong className="text-white">{gin.customer_name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-orange-400 mb-1">Số Phiếu Xuất Kho *</label>
              <input
                type="text"
                value={issueCode}
                onChange={(e) => setIssueCode(e.target.value)}
                className="w-full bg-neutral-950 border border-orange-500/60 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Ngày xuất kho</label>
              <input
                type="text"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Kho xuất</label>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="Hà Nội">Hà Nội</option>
                <option value="Hồ Chí Minh">Hồ Chí Minh</option>
              </select>
            </div>
          </div>

          <div className="border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-black/60 text-xs uppercase text-neutral-400 border-b border-neutral-800">
                  <th className="p-3">Mã SKU</th>
                  <th className="p-3 w-1/2">Tên hàng hóa</th>
                  <th className="p-3 text-center">SL Thực xuất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-mono text-white font-semibold">{item.sku}</td>
                    <td className="p-3 text-neutral-300 leading-tight">{item.name}</td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, qty: val } : row))
                          );
                        }}
                        className="w-24 text-center bg-neutral-950 border border-neutral-700 focus:border-orange-500 rounded-lg py-1.5 text-emerald-400 font-bold outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-bold"
          >
            CẬP NHẬT PHIẾU XUẤT KHO
          </button>
        </div>
      </div>
    </div>
  );
}

function GRNDetailModal({ grn, products, onClose, onEdit }) {
  const totalQty = grn.items.reduce((sum, i) => sum + Number(i.qty), 0);
  const totalAmount = grn.items.reduce((sum, i) => sum + Number(i.qty) * Number(i.import_price), 0);
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center shrink-0">
          <div>
            <span className="text-xs uppercase font-bold text-orange-500">Chi tiết Phiếu Nhập Kho (Inbound)</span>
            <h3 className="text-xl font-bold text-white font-mono mt-0.5">{grn.receipt_code}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-3 gap-4 bg-black/40 p-4 rounded-xl border border-neutral-800 text-sm">
            <div>
              <p className="text-xs text-neutral-400">Nhà cung cấp</p>
              <p className="font-bold text-white mt-0.5">{grn.supplier}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Kho nhập hàng</p>
              <p className="font-bold text-orange-400 mt-0.5">{grn.warehouse}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Ngày nhập kho</p>
              <p className="font-bold text-white mt-0.5">{grn.date}</p>
            </div>
          </div>
          <div className="border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-black/60 text-xs uppercase text-neutral-400 border-b border-neutral-800">
                  <th className="p-3 text-center w-12">STT</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Mã SKU</th>
                  <th className="p-3 w-1/3">Tên hàng hóa</th>
                  <th className="p-3 text-center">SL Nhập</th>
                  <th className="p-3 text-right">Đơn giá nhập</th>
                  <th className="p-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {grn.items.map((item, idx) => {
                  const lineTotal = Number(item.qty) * Number(item.import_price);
                  return (
                    <tr key={idx} className="hover:bg-neutral-800/30">
                      <td className="p-3 text-center text-neutral-400">{idx + 1}</td>
                      <td className="p-3">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400">
                          {resolveItemBrand(item, products)}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-white">{item.sku}</td>
                      <td className="p-3 text-neutral-300 leading-tight">{item.name}</td>
                      <td className="p-3 text-center font-bold text-white">{item.qty}</td>
                      <td className="p-3 text-right text-neutral-300">{Number(item.import_price).toLocaleString()} đ</td>
                      <td className="p-3 text-right font-semibold text-emerald-400">{lineTotal.toLocaleString()} đ</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-black/60 border-t border-neutral-700 font-bold text-sm">
                  <td colSpan="4" className="p-3 text-right text-neutral-300">TỔNG CỘNG:</td>
                  <td className="p-3 text-center text-orange-400">{totalQty} SP</td>
                  <td></td>
                  <td className="p-3 text-right text-emerald-400">{totalAmount.toLocaleString()} đ</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3 shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="bg-neutral-800 hover:bg-amber-600 text-amber-400 hover:text-white px-5 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <Pencil size={14} /> Chỉnh sửa phiếu
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function GINDetailModal({ gin, onClose, onEdit }) {
  const totalQty = gin.items.reduce((sum, i) => sum + Number(i.qty), 0);
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-black border-b border-neutral-800 flex justify-between items-center shrink-0">
          <div>
            <span className="text-xs uppercase font-bold text-orange-500">Chi tiết Phiếu Xuất Kho (Outbound)</span>
            <h3 className="text-xl font-bold text-white font-mono mt-0.5">{gin.issue_code}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl border border-neutral-800 text-sm">
            <div>
              <p className="text-xs text-neutral-400">Số SO tham chiếu</p>
              <p className="font-bold text-orange-400 font-mono mt-0.5">{gin.so_code}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Số PAKD tham chiếu</p>
              <p className="font-bold text-white font-mono mt-0.5">{gin.pakd_code || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Khách hàng nhận</p>
              <p className="font-bold text-white mt-0.5">{gin.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Kho & Ngày xuất</p>
              <p className="font-bold text-white mt-0.5">{gin.warehouse} • {gin.date}</p>
            </div>
          </div>
          <div className="border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-black/60 text-xs uppercase text-neutral-400 border-b border-neutral-800">
                  <th className="p-3 text-center w-12">STT</th>
                  <th className="p-3">Mã SKU</th>
                  <th className="p-3 w-1/2">Tên hàng hóa</th>
                  <th className="p-3 text-center">SL Thực xuất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {gin.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/30">
                    <td className="p-3 text-center text-neutral-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-semibold text-white">{item.sku}</td>
                    <td className="p-3 text-neutral-300 leading-tight">{item.name}</td>
                    <td className="p-3 text-center font-bold text-emerald-400">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-black/60 border-t border-neutral-700 font-bold text-sm">
                  <td colSpan="3" className="p-3 text-right text-neutral-300">TỔNG SỐ LƯỢNG XUẤT KHO:</td>
                  <td className="p-3 text-center text-orange-400">{totalQty} SP</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="p-4 bg-black border-t border-neutral-800 flex justify-end gap-3 shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="bg-neutral-800 hover:bg-amber-600 text-amber-400 hover:text-white px-5 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <Pencil size={14} /> Chỉnh sửa phiếu
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
