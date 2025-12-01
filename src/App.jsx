import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

// --- SVG ICON BILEŞENLERI ---
const DollarSign = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
const Clock = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const Calendar = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>);
const CheckCircle = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.6-8.25"/><path d="M16.5 7.5l-6.5 6.5-3-3"/></svg>);
const Trash2 = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>);
const Settings = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.22a2 2 0 0 1-1.4 1.4L4.9 7.1a2 2 0 0 0-1.4 1.4v.44a2 2 0 0 0 2 2h.22a2 2 0 0 1 1.4 1.4L7.1 19.1a2 2 0 0 0 1.4 1.4h.44a2 2 0 0 0 2-2v-.22a2 2 0 0 1 1.4-1.4l1.83-1.83a2 2 0 0 0 1.4-1.4v-.44a2 2 0 0 0 2-2h-.22a2 2 0 0 1-1.4-1.4L19.1 4.9a2 2 0 0 0-1.4-1.4h-.44a2 2 0 0 0-2 2v.22a2 2 0 0 1-1.4 1.4L12.22 2z"/><circle cx="12" cy="12" r="3"/></svg>);
const BarChart3 = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>);
// --- SVG BİTİŞ ---

// --- GLOBAL SABİTLER ---
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const APP_ID = rawAppId.replace(/\//g, '_');

const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {}; 
const initialAuthToken = typeof __initial_auth_token !== 'undefined' 
    ? __initial_auth_token 
    : null;

const HOURS_PER_FULL_DAY = 8;
const DEFAULT_DAILY_WAGE = 800;
const COLLECTION_NAME = 'work_entries';
const PREFS_DOC_PATH = 'preferences';
const PREFS_DOC_ID = 'settings';
const INITIAL_HOURLY_WAGE = DEFAULT_DAILY_WAGE / HOURS_PER_FULL_DAY;

const IS_FIREBASE_CONFIG_VALID = Object.keys(firebaseConfig).length > 5;

const getDateId = (date) => new Date(date).toISOString().split('T')[0];
const getDurationByStatus = (status) => {
    switch (status) {
        case 'full':
        case 'paid_absence':
            return HOURS_PER_FULL_DAY; 
        case 'half':
            return HOURS_PER_FULL_DAY / 2;
        default:
            return 0;
    }
};

// --- MODAL ---
const DeleteConfirmationModal = ({ isOpen, onDelete, onCancel, recordId }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-auto p-6 border-t-4 border-red-500 animate-fade-in-up">
            <h3 className="text-lg font-bold text-red-700 mb-3">Silme Onayı</h3>
            <p className="text-gray-600 mb-6 text-sm">
                Seçili kaydı (<span className="font-mono bg-gray-100 px-1 rounded">{recordId}</span>) kalıcı olarak silmek istediğinizden emin misiniz?
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={onCancel} className="py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition">İptal</button>
              <button onClick={onDelete} className="py-2 px-4 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition">Evet, Sil</button>
            </div>
          </div>
        </div>
    );
};

// --- WORK HISTORY CHART ---
const WorkHistoryChart = React.memo(({ entries, hoursPerFullDay }) => {
    const last7Entries = useMemo(() => entries.slice(0, 7).reverse(), [entries]);

    if (last7Entries.length === 0) return <p className="text-center text-gray-500 py-4 text-sm">Görüntülenecek yeterli kayıt yok.</p>;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Son Çalışma Yoğunluğu ({last7Entries.length} Gün)
            </h2>
            <div className="flex justify-between items-end h-32 space-x-2 border-b border-gray-200 pt-4">
                {last7Entries.map((entry, index) => {
                    const heightPercentage = (entry.duration / hoursPerFullDay) * 100;
                    const label = new Date(entry.date + "T00:00:00").toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                    return (
                        <div key={entry.id || index} className="flex flex-col items-center h-full flex-1 min-w-[30px] group">
                            <div className="w-full bg-blue-600/80 rounded-t-md transition-all duration-500 hover:bg-blue-400 relative cursor-pointer" style={{ height: `${Math.max(1, heightPercentage)}%` }} title={`${entry.date}: ${entry.duration.toFixed(1)} Gün`}>
                                <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white p-1 rounded-sm shadow whitespace-nowrap">
                                    {entry.duration.toFixed(1)} Gün
                                </span>
                            </div>
                            <span className="mt-1 text-xs text-gray-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full">{label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

// --- ANA BİLEŞEN ---
export const App = () => {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [entries, setEntries] = useState([]);
  const [hourlyWage, setHourlyWage] = useState(INITIAL_HOURLY_WAGE); 
  const [dailyWageInput, setDailyWageInput] = useState(DEFAULT_DAILY_WAGE.toString()); 
  const [currentEntry, setCurrentEntry] = useState({ date: new Date().toISOString().split('T')[0], status: 'full' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null); 
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); 
  const messageTimeoutRef = useRef(null);

  const showMessage = (text, type='success') => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setMessage({ text, type });
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const requestDelete = (id) => setConfirmDeleteId(id);

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const idToDelete = confirmDeleteId;
    setConfirmDeleteId(null);

    if (!db || userId === 'LOCAL_USER_MODE') {
        setEntries(prev => prev.filter(e => e.id !== idToDelete));
        showMessage("Kayıt YEREL olarak silindi.", 'error');
        return;
    }

    try {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, COLLECTION_NAME, idToDelete);
        await deleteDoc(docRef);
        showMessage("Kayıt başarıyla silindi.", 'success');
    } catch (e) {
        console.error(e);
        showMessage("Giriş silinirken bir hata oluştu.", 'error');
    }
  };

  useEffect(() => {
    if (!IS_FIREBASE_CONFIG_VALID) {
        setTimeout(() => {
            setUserId('LOCAL_USER_MODE'); 
            setIsAuthReady(true); 
            setLoading(false);
            showMessage("Veritabanı bağlantısı eksik. YEREL MOD.", 'error');
        }, 1000);
        return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);

      const authenticateUser = async () => {
        try {
          if (initialAuthToken) await signInWithCustomToken(firebaseAuth, initialAuthToken);
          else await signInAnonymously(firebaseAuth);
        } catch (e) {
          console.error(e);
          showMessage("Kimlik doğrulama başarısız.", 'error');
        }
      };
      
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        setUserId(user ? user.uid : null);
        setIsAuthReady(true);
        setLoading(false);
      });

      authenticateUser();
      return () => unsubscribe(); 

    } catch (e) {
      console.error(e);
      showMessage("Uygulama başlatılırken kritik hata oluştu.", 'error');
      setLoading(false);
      setIsAuthReady(true); 
    }
  }, []);

  const loadWage = useCallback(async (dbInstance, uid) => {
    if (!dbInstance || !uid || uid === 'LOCAL_USER_MODE') return; 
    try {
        const prefsDocRef = doc(dbInstance, 'artifacts', APP_ID, 'users', uid, PREFS_DOC_PATH, PREFS_DOC_ID);
        const docSnap = await getDoc(prefsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.hourlyWage && typeof data.hourlyWage === 'number') {
                const fetchedHourlyWage = data.hourlyWage;
                setHourlyWage(fetchedHourlyWage);
                setDailyWageInput((fetchedHourlyWage * HOURS_PER_FULL_DAY).toFixed(0));
            }
        }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (db && userId && isAuthReady && userId !== 'LOCAL_USER_MODE') {
        loadWage(db, userId);
        const entriesCollectionRef = collection(db, 'artifacts', APP_ID, 'users', userId, COLLECTION_NAME);
        const q = query(entriesCollectionRef); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedEntries = snapshot.docs.map(doc => {
            const data = doc.data();
            const entryDuration = data.duration || getDurationByStatus(data.status);
            return { id: doc.id, ...data, duration: entryDuration, hourlyWage: data.hourlyWage || hourlyWage };
          });
          fetchedEntries.sort((a,b)=> new Date(b.date)-new Date(a.date));
          setEntries(fetchedEntries);
        }, (err) => { console.error(err); showMessage("Veri yüklenirken hata oluştu.", 'error'); });

        return () => unsubscribe(); 
    }
  }, [db, userId, isAuthReady, loadWage]);

  const saveDailyWage = async () => {
    const newDailyWage = parseFloat(dailyWageInput);
    if (isNaN(newDailyWage) || newDailyWage <= 0) { showMessage("Geçerli sayı girin.", 'error'); return; }
    const calculatedHourlyWage = newDailyWage / HOURS_PER_FULL_DAY;
    setHourlyWage(calculatedHourlyWage);

    if (!db || userId === 'LOCAL_USER_MODE') {
        showMessage(`Günlük Tam Ücret ${newDailyWage.toFixed(2)} TL YEREL olarak ayarlandı.`, 'error');
        return; 
    }

    try {
        const prefsDocRef = doc(db, 'artifacts', APP_ID, 'users', userId, PREFS_DOC_PATH, PREFS_DOC_ID);
        await setDoc(prefsDocRef, { hourlyWage: calculatedHourlyWage }, { merge: true });
        showMessage(`Günlük Tam Ücret ${newDailyWage.toFixed(2)} TL kaydedildi.`);
    } catch (e) { console.error(e); showMessage("Ücret kaydedilemedi.", 'error'); }
  };

  const addEntry = async () => {
    if (!currentEntry.date || !currentEntry.status) { showMessage("Tarih ve Durum seçin.", 'error'); return; }
    const duration = getDurationByStatus(currentEntry.status);
    const id = getDateId(currentEntry.date);
    const newEntry = { id, date: currentEntry.date, status: currentEntry.status, duration, hourlyWage, createdAt: serverTimestamp() };

    if (entries.some(e => e.id===id)) { showMessage("Bu tarihe kayıt var.", 'error'); return; }

    if (!db || userId==='LOCAL_USER_MODE') {
        const localEntry = { ...newEntry, createdAt: new Date().toISOString() };
        setEntries(prev => [localEntry, ...prev]);
        showMessage("Kayıt YEREL olarak eklendi.");
        return;
    }

    try {
        const entryRef = doc(db, 'artifacts', APP_ID, 'users', userId, COLLECTION_NAME, id);
        await setDoc(entryRef, newEntry);
        showMessage("Kayıt başarıyla eklendi.");
    } catch (e) { console.error(e); showMessage("Kayıt eklenemedi.", 'error'); }
  };

  if (loading) return <div className="text-center mt-10 text-gray-500">Yükleniyor...</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen font-sans">
        {message && <div className={`mb-4 p-3 rounded-md ${message.type==='success'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{message.text}</div>}

        <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
            <h1 className="text-xl font-bold mb-4">Günlük Ücret Ayarı</h1>
            <div className="flex items-center space-x-3">
                <input 
                    type="number" 
                    value={dailyWageInput} 
                    onChange={e=>setDailyWageInput(e.target.value)} 
                    className="border px-3 py-2 rounded-md w-32" 
                />
                <button onClick={saveDailyWage} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Kaydet</button>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
            <h2 className="text-lg font-bold mb-3">Yeni Çalışma Kaydı</h2>
            <div className="flex items-center space-x-3">
                <input type="date" value={currentEntry.date} onChange={e=>setCurrentEntry(prev=>({...prev,date:e.target.value}))} className="border px-3 py-2 rounded-md"/>
                <select value={currentEntry.status} onChange={e=>setCurrentEntry(prev=>({...prev,status:e.target.value}))} className="border px-3 py-2 rounded-md">
                    <option value="full">Tam Gün</option>
                    <option value="half">Yarım Gün</option>
                    <option value="paid_absence">Ücretli İzin</option>
                    <option value="absent">İzin</option>
                </select>
                <button onClick={addEntry} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Ekle</button>
            </div>
        </div>

        <WorkHistoryChart entries={entries} hoursPerFullDay={HOURS_PER_FULL_DAY} />

        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-lg font-bold mb-3">Kayıtlar</h2>
            {entries.length===0 && <p className="text-gray-500 text-sm">Henüz kayıt yok.</p>}
            <ul>
                {entries.map(entry => (
                    <li key={entry.id} className="flex justify-between items-center border-b py-2">
                        <div>{entry.date} - {entry.status} - {entry.duration.toFixed(1)} saat</div>
                        <button onClick={()=>requestDelete(entry.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-5 h-5" /></button>
                    </li>
                ))}
            </ul>
        </div>

        <DeleteConfirmationModal 
            isOpen={!!confirmDeleteId} 
            recordId={confirmDeleteId} 
            onDelete={executeDelete} 
            onCancel={()=>setConfirmDeleteId(null)} 
        />
    </div>
  );
};
