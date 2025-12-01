import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

// --- INLINE SVG ICON BILEŞENLERI ---
const DollarSign = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
const Clock = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const Calendar = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>);
const CheckCircle = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.6-8.25"/><path d="M16.5 7.5l-6.5 6.5-3-3"/></svg>);
const Trash2 = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>);
const Settings = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.22a2 2 0 0 1-1.4 1.4L4.9 7.1a2 2 0 0 0-1.4 1.4v.44a2 2 0 0 0 2 2h.22a2 2 0 0 1 1.4 1.4L7.1 19.1a2 2 0 0 0 1.4 1.4h.44a2 2 0 0 0 2-2v-.22a2 2 0 0 1 1.4-1.4l1.83-1.83a2 2 0 0 0 1.4-1.4v-.44a2 2 0 0 0 2-2h-.22a2 2 0 0 1-1.4-1.4L19.1 4.9a2 2 0 0 0-1.4-1.4h-.44a2 2 0 0 0-2 2v.22a2 2 0 0 1-1.4 1.4L12.22 2z"/><circle cx="12" cy="12" r="3"/></svg>);
const BarChart3 = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>);
// --- INLINE SVG ICON BILEŞENLERI BİTİŞ ---

// = CANVAS ORTAMINDA ZORUNLU KULLANILMASI GEREKEN GLOBAL DEĞİŞKENLER =
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const APP_ID = rawAppId.replace(/\//g, '_'); 

const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {}; 
const initialAuthToken = typeof __initial_auth_token !== 'undefined' 
    ? __initial_auth_token 
    : null;
// = VERİTABANI AYARLARI BİTİŞ =

// --- SABİTLER ---
const HOURS_PER_FULL_DAY = 8;
const DEFAULT_DAILY_WAGE = 800;
const COLLECTION_NAME = 'work_entries';
const PREFS_DOC_PATH = 'preferences'; 
const PREFS_DOC_ID = 'settings'; 
const INITIAL_HOURLY_WAGE = DEFAULT_DAILY_WAGE / HOURS_PER_FULL_DAY;

// Yapılandırma kontrolü: Eğer config'de bir alan varsa geçerlidir.
const IS_FIREBASE_CONFIG_VALID = Object.keys(firebaseConfig).length > 5; // En az 6 alan (apiKey, authDomain, projectId, vs.) olmalı.

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

// --- YARDIMCI BİLEŞENLER (WorkHistoryChart ve Modal) ---

const WorkHistoryChart = React.memo(({ entries, hoursPerFullDay }) => {
    // Sadece en son 7 kaydı al
    const last7Entries = useMemo(() => {
        return entries.slice(0, 7).reverse(); 
    }, [entries]);

    if (last7Entries.length === 0) {
        return <p className="text-center text-gray-500 py-4 text-sm">Görüntülenecek yeterli kayıt yok.</p>;
    }

    const maxDayEquivalent = hoursPerFullDay / hoursPerFullDay; 

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Son Çalışma Yoğunluğu ({last7Entries.length} Gün)
            </h2>
            <div className="flex justify-between items-end h-32 space-x-2 border-b border-gray-200 pt-4">
                {last7Entries.map((entry, index) => {
                    const dayEquivalent = entry.duration / hoursPerFullDay;
                    const heightPercentage = (dayEquivalent / maxDayEquivalent) * 100;
                    
                    let label = new Date(entry.date + "T00:00:00").toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                    
                    return (
                        <div key={entry.id || index} className="flex flex-col items-center h-full flex-1 min-w-[30px] group">
                            <div 
                                className="w-full bg-blue-600/80 rounded-t-md transition-all duration-500 hover:bg-blue-400 relative cursor-pointer"
                                style={{ height: `${Math.max(1, heightPercentage)}%` }} 
                                title={`${entry.date}: ${dayEquivalent.toFixed(1)} Gün`}
                            >
                                <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white p-1 rounded-sm shadow whitespace-nowrap">
                                    {dayEquivalent.toFixed(1)} Gün
                                </span>
                            </div>
                            <span className="mt-1 text-xs text-gray-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

const DeleteConfirmationModal = ({ isOpen, onDelete, onCancel, recordId }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-auto p-6 border-t-4 border-red-500 animate-fade-in-up">
            <h3 className="text-lg font-bold text-red-700 mb-3">
                Silme Onayı
            </h3>
            <p className="text-gray-600 mb-6 text-sm">
                Seçili kaydı (<span className="font-mono bg-gray-100 px-1 rounded">{recordId}</span>) kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onCancel}
                className="py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition"
              >
                İptal
              </button>
              <button
                onClick={onDelete}
                className="py-2 px-4 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
    );
};

// --- ANA BİLEŞEN ---

export const App = () => {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [entries, setEntries] = useState([]);
  const [hourlyWage, setHourlyWage] = useState(INITIAL_HOURLY_WAGE); 
  const [dailyWageInput, setDailyWageInput] = useState(DEFAULT_DAILY_WAGE.toString()); 
  
  const [currentEntry, setCurrentEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'full',
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null); 
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); 

  const showMessage = (text, type = 'success') => {
      setMessage({ text, type });
      setTimeout(() => setMessage(null), 3000); 
  };
  
  const requestDelete = (id) => {
    setConfirmDeleteId(id);
  };
  
  const executeDelete = async () => {
    if (!confirmDeleteId) return;

    const idToDelete = confirmDeleteId;
    setConfirmDeleteId(null); 

    // 1. Yerel Mod Silme (Hata durumunda veya config yoksa)
    if (!db || userId === 'LOCAL_USER_MODE') {
        setEntries(prevEntries => prevEntries.filter(e => e.id !== idToDelete));
        showMessage("Kayıt YEREL olarak silindi.", 'error');
        return; 
    }

    // 2. Firebase Silme
    try {
        // Doğru Firestore yolunu kullan
        const docRef = doc(db, `/artifacts/${APP_ID}/users/${userId}/${COLLECTION_NAME}`, idToDelete);
        await deleteDoc(docRef);
        showMessage("Kayıt başarıyla silindi.", 'success');
    } catch (e) {
        console.error("Giriş silinirken hata oluştu:", e);
        showMessage("Giriş silinirken bir hata oluştu. Konsolu kontrol edin.", 'error');
    }
  };


  // 1. Firebase Başlatma ve Kimlik Doğrulama
  useEffect(() => {
    // Eğer config geçerli değilse, hemen local moda geç
    if (!IS_FIREBASE_CONFIG_VALID) {
        console.error("Firebase Yapılandırması Eksik. Uygulama Yerel Modda Başlatılıyor.");
        // Başlangıçta 5 saniye bekle ki kullanıcı yükleme ekranını görsün
        setTimeout(() => {
            setUserId('LOCAL_USER_MODE'); 
            setIsAuthReady(true); 
            setLoading(false);
            showMessage("Veritabanı bağlantısı eksik. Kayıtlar sadece bu oturum için geçerlidir (YEREL MOD).", 'error');
        }, 1000); 
        return;
    }

    // Config geçerliyse Firebase'i başlat
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);

      const authenticateUser = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (e) {
          console.error("Kimlik doğrulama başarısız:", e);
          showMessage("Kimlik doğrulama başarısız oldu. Veri erişimi kısıtlı olabilir.", 'error');
        }
      };
      
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          setUserId(null); 
        }
        setIsAuthReady(true);
        setLoading(false);
      });

      authenticateUser();
      return () => unsubscribe(); 

    } catch (e) {
      console.error("Firebase başlatma hatası:", e);
      showMessage("Uygulama başlatılırken kritik hata oluştu.", 'error');
      setLoading(false);
      setIsAuthReady(true); 
    }
  }, []); 

  // 2. Ücreti Yükleme
  const loadWage = useCallback(async (dbInstance, uid) => {
    if (!dbInstance || !uid || uid === 'LOCAL_USER_MODE') return; 
    
    try {
        const prefsDocRef = doc(dbInstance, `/artifacts/${APP_ID}/users/${uid}/${PREFS_DOC_PATH}`, PREFS_DOC_ID);
        const docSnap = await getDoc(prefsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.hourlyWage && typeof data.hourlyWage === 'number') {
                const fetchedHourlyWage = data.hourlyWage;
                setHourlyWage(fetchedHourlyWage);
                const dailyWage = fetchedHourlyWage * HOURS_PER_FULL_DAY;
                setDailyWageInput(dailyWage.toFixed(0)); // Yuvarlanmış tam sayı göster
            }
        }
    } catch (e) {
        console.error("Ücret ayarı yüklenirken hata:", e);
    }
  }, []);

  // 3. Veri Çekme (Real-time Listener)
  useEffect(() => {
    // Yalnızca Firebase BAĞLIYSA ve Auth TAMAMLANMIŞSA dinlemeye başla
    if (db && userId && isAuthReady && userId !== 'LOCAL_USER_MODE') {

        loadWage(db, userId);

        const path = `/artifacts/${APP_ID}/users/${userId}/${COLLECTION_NAME}`;
        const entriesCollectionRef = collection(db, path);
        const q = query(entriesCollectionRef); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedEntries = snapshot.docs.map(doc => {
            const data = doc.data();
            const entryDuration = data.duration || getDurationByStatus(data.status);
            return {
              id: doc.id,
              ...data,
              duration: entryDuration,
              hourlyWage: data.hourlyWage || hourlyWage, 
            };
          });
          fetchedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
          setEntries(fetchedEntries);
        }, (err) => {
          console.error("Firestore veri dinleme hatası:", err);
          showMessage("Veri yüklenirken bir hata oluştu.", 'error');
        });

        return () => unsubscribe(); 
    }
  }, [db, userId, isAuthReady, hourlyWage, loadWage]); 


  // Günlük Tam Ücreti Kaydetme
  const saveDailyWage = async () => {
    const newDailyWage = parseFloat(dailyWageInput);
    
    if (isNaN(newDailyWage) || newDailyWage <= 0) {
        showMessage("Lütfen geçerli bir pozitif sayı girin.", 'error');
        return;
    }
    
    const calculatedHourlyWage = newDailyWage / HOURS_PER_FULL_DAY; 
    setHourlyWage(calculatedHourlyWage);

    // Veritabanı bağlantısı yoksa yerel modda kal
    if (!db || userId === 'LOCAL_USER_MODE') {
        showMessage(`Günlük Tam Ücret ${newDailyWage.toFixed(2)} TL olarak YEREL olarak ayarlandı.`, 'error');
        return; 
    }

    try {
        const prefsDocRef = doc(db, `/artifacts/${APP_ID}/users/${userId}/${PREFS_DOC_PATH}`, PREFS_DOC_ID);
        await setDoc(prefsDocRef, { hourlyWage: calculatedHourlyWage }, { merge: true });
        showMessage(`Günlük Tam Ücret ${newDailyWage.toFixed(2)} TL olarak kaydedildi.`);
    } catch (e) {
        console.error("Ücret ayarı kaydedilirken hata:", e);
        showMessage("Ücret kaydedilemedi. Konsolu kontrol edin.", 'error');
    }
  };

  // Yeni Giriş Ekleme
  const addEntry = async () => {
    if (!currentEntry.date || !currentEntry.status) {
      showMessage("Lütfen Tarih ve Çalışma Durumu alanlarını doldurun.", 'error');
      return;
    }
    
    const duration = getDurationByStatus(currentEntry.status);
    const id = getDateId(currentEntry.date);
    
    const newEntry = {
        id: id,
        date: currentEntry.date,
        status: currentEntry.status,
        duration: duration, 
        hourlyWage: hourlyWage, 
        createdAt: serverTimestamp(),
    };

    if (entries.some(e => e.id === id)) {
        showMessage("Bu tarihe zaten bir kayıt eklenmiş.", 'error');
        return;
    }

    // Veritabanı bağlantısı yoksa yerel modda state'i güncelle
    if (!db || userId === 'LOCAL_USER_MODE') {
        // Firebase Timestamp yerine sadece mevcut saati kullan (Yerel Mod için)
        const localEntry = { ...newEntry, createdAt: new Date().toISOString() }; 

        setEntries(prevEntries => {
            const updatedEntries = [...prevEntries, localEntry];
            updatedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
            return updatedEntries;
        });

        setCurrentEntry({
            date: new Date().toISOString().split('T')[0],
            status: 'full',
        });
        showMessage("Giriş YEREL olarak eklendi.", 'error');
        return; 
    }

    // Firebase Kayıt
    try {
      const entryRef = doc(collection(db, `/artifacts/${APP_ID}/users/${userId}/${COLLECTION_NAME}`), newEntry.id);
      await setDoc(entryRef, newEntry, { merge: false });

      setCurrentEntry({
        date: new Date().toISOString().split('T')[0],
        status: 'full',
      });
      showMessage("Giriş başarıyla eklendi.");

    } catch (e) {
      console.error("Giriş eklenirken hata oluştu:", e);
      showMessage("Giriş eklenirken bir hata oluştu. Konsolu kontrol edin.", 'error');
    }
  };


  // Toplam Hesaplamalar
  const totals = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const wage = entry.hourlyWage > 0 ? entry.hourlyWage : hourlyWage;
      const hours = entry.duration;
      const payment = hours * wage;
      acc.totalHours += hours;
      acc.totalPayment += payment;
      return acc;
    }, { totalHours: 0, totalPayment: 0 });
  }, [entries, hourlyWage]);

  const currentDailyWageDisplay = hourlyWage * HOURS_PER_FULL_DAY;
  
  const statusOptions = [
    { label: 'Tam Gün', value: 'full' },
    { label: 'Yarım Gün', value: 'half' },
    { label: 'Ücretli İzin', value: 'paid_absence' },
  ];

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <p className="text-xl font-semibold text-blue-500 animate-pulse">Uygulama Başlatılıyor ve Veritabanı Kontrol Ediliyor...</p>
        </div>
    );
  }

  // Kayıt Listesi Bileşeni
  const EntryItem = ({ entry }) => {
    const hours = entry.duration;
    const paymentWage = entry.hourlyWage > 0 ? entry.hourlyWage : hourlyWage;

    const payment = hours * paymentWage;
    const dayEquivalent = hours / HOURS_PER_FULL_DAY; 
    
    const statusText = statusOptions.find(o => o.value === entry.status)?.label || 'Bilinmiyor';

    return (
      <div className="flex justify-between items-center py-4 border-b border-gray-100 hover:bg-blue-50/50 transition duration-150 rounded-lg pr-2">
        <div className="flex items-center flex-1 min-w-0 ml-2">
             <Calendar className="w-5 h-5 text-blue-500 mr-3 hidden sm:block" />
            <div className="flex flex-col">
                <p className="text-base font-semibold text-gray-800 truncate">{entry.date}</p>
                <p className={`text-xs font-medium ${entry.status === 'paid_absence' ? 'text-purple-500' : 'text-gray-500'}`}>{statusText}</p>
            </div>
        </div>
        <div className="flex flex-col items-end mr-4">
            <p className="text-base font-bold text-green-600">{dayEquivalent.toFixed(1)} Gün</p>
            <p className="text-sm font-medium text-gray-700">{payment.toFixed(2)} TL</p>
        </div>
        <button 
          onClick={() => requestDelete(entry.id)} 
          className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition duration-150 shadow-sm"
          title="Kaydı Sil"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Ana Arayüz
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
        <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            .animate-fade-in { animation: fadeIn 0.5s ease-out; }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fade-in-up { animation: fadeInUp 0.3s ease-out; }
        `}</style>
      <div className="max-w-xl mx-auto">
        {/* Mesaj Kutusu */}
        {message && (
            <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg z-50 ${message.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white font-semibold transition-opacity duration-300 animate-fade-in`}>
                {message.text}
            </div>
        )}

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2 border-b-4 border-blue-600 pb-2">İş Günü Takip Sistemi</h1>
        <p className="text-xs text-gray-500 mb-6">
            Kullanıcı ID: <span className="font-mono text-xs font-semibold bg-gray-200 px-1 rounded">{userId === 'LOCAL_USER_MODE' ? "YEREL MOD (GEÇİCİ)" : userId || "Bağlanılıyor..."}</span>
        </p>
        
        {/* Günlük Ücret Ayarı */}
        <div className="bg-white p-6 rounded-xl shadow-xl mb-8 border border-gray-200 animate-fade-in-up">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-yellow-600" />
                Günlük Tam Ücret Ayarı
            </h2>
            <input
                type="number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 mb-3 transition duration-150"
                placeholder="Günlük Tam Ücret (TL)"
                value={dailyWageInput}
                onChange={(e) => setDailyWageInput(e.target.value)}
            />
            <button 
                onClick={saveDailyWage}
                className="w-full py-3 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700 transition duration-150 shadow-md transform hover:scale-[1.01]"
                disabled={!isAuthReady} 
            >
                Ücreti Kaydet
            </button>
            <p className="text-sm text-gray-600 mt-4 pt-3 border-t border-gray-100">
                Kayıtlı Günlük Ücret: <span className="font-bold text-lg text-green-700">{currentDailyWageDisplay.toFixed(2)} TL</span>
            </p>
        </div>

        {/* Toplam Kartlar */}
        <div className="flex justify-between space-x-4 mb-8 animate-fade-in-up delay-100">
            <div className="flex-1 p-5 rounded-xl shadow-xl bg-blue-600 text-white flex flex-col items-start transform transition duration-300 hover:scale-[1.03]">
                <Clock className="w-6 h-6 mb-2 opacity-80" />
                <p className="text-xs font-semibold uppercase opacity-90">Toplam Gün Karşılığı</p>
                <p className="text-3xl font-extrabold mt-1">{(totals.totalHours / HOURS_PER_FULL_DAY).toFixed(1)} Gün</p>
            </div>
            <div className="flex-1 p-5 rounded-xl shadow-xl bg-green-600 text-white flex flex-col items-start transform transition duration-300 hover:scale-[1.03]">
                <DollarSign className="w-6 h-6 mb-2 opacity-80" />
                <p className="text-xs font-semibold uppercase opacity-90">Tahmini Toplam Kazanç</p>
                <p className="text-3xl font-extrabold mt-1">{totals.totalPayment.toFixed(2)} TL</p>
            </div>
        </div>


        {/* Yeni Giriş Formu */}
        <div className="bg-white p-6 rounded-xl shadow-xl mb-8 border border-gray-200 animate-fade-in-up delay-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
             <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Yeni Gün Kaydı
          </h2>
          
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarih:</label>
          <input
            type="date"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4 transition duration-150"
            value={currentEntry.date}
            onChange={(e) => setCurrentEntry(prev => ({ ...prev, date: e.target.value }))}
          />

          <label className="block text-sm font-medium text-gray-700 mb-2">Çalışma Durumu:</label>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button" 
                className={`w-full py-3 px-1 text-sm font-semibold rounded-lg border transition duration-150 cursor-pointer text-center ${
                  currentEntry.status === option.value 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-300/50' 
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400' 
                }`}
                onClick={() => setCurrentEntry(prev => ({ ...prev, status: option.value }))}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          <p className="text-sm font-medium text-gray-700 mb-4">Tahmini Kazanç: <span className="font-bold text-blue-600 text-base">{(getDurationByStatus(currentEntry.status) * hourlyWage).toFixed(2)} TL</span></p>

          <button 
            onClick={addEntry}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-150 shadow-lg shadow-blue-400/50 transform hover:scale-[1.01]"
            disabled={!isAuthReady} 
          >
            <CheckCircle className="w-5 h-5 inline-block mr-2" />
            Girişi Kaydet
          </button>
        </div>

        {/* Çalışma Geçmişi Grafiği */}
        <WorkHistoryChart entries={entries} hoursPerFullDay={HOURS_PER_FULL_DAY} />

        {/* Kayıtlı Girişler */}
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 animate-fade-in-up delay-300">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-600" />
            Kayıtlı Girişler ({entries.length})
          </h2>
          {entries.length === 0 ? (
            <p className="text-center text-gray-500 py-6">Henüz kayıtlı giriş yok.</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {entries.map(item => <EntryItem key={item.id} entry={item} />)}
            </div>
          )}
        </div>
      </div>
      
      {/* SİLME ONAY MODALI (Local veya Firebase modunda çalışır) */}
      <DeleteConfirmationModal
          isOpen={!!confirmDeleteId}
          onDelete={executeDelete}
          onCancel={() => setConfirmDeleteId(null)}
          recordId={confirmDeleteId}
      />
    </div>
  );
};

export default App;