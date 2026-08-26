import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Database, Loader2, Calendar, Clock as ClockIcon, Hash, LogIn, User, MapPin, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { SheetTab, fetchSpreadsheetMetadata, fetchSheetData, fetchPublicGvizValues, fetchPublicTabsFallback } from '../lib/googleSheets';
import { motion } from 'motion/react';
import { getAccessToken, googleSignIn } from '../lib/firebase';

interface MeetingHeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (header: string) => void;
}

interface MeetingData {
  id: number;
  seq: string;
  name: string;
  time: string;
  date: string;
  reporter: string;
  room: string;
  raw: any[];
}

export const MeetingHeaderModal: React.FC<MeetingHeaderModalProps> = ({ isOpen, onClose, onInsert }) => {
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [episode, setEpisode] = useState<string>('');
  const [customTime, setCustomTime] = useState<string>('');
  const [searchNameInput, setSearchNameInput] = useState<string>('');
  const [searchReporterInput, setSearchReporterInput] = useState<string>('');
  const [appliedSearchName, setAppliedSearchName] = useState<string>('');
  const [appliedSearchReporter, setAppliedSearchReporter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTabs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      let sheets: SheetTab[] = [];

      // 1. Try server/serverless API endpoint
      try {
        const response = await fetch('/api/sheets/tabs', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data && Array.isArray(data.sheets) && data.sheets.length > 0) {
            sheets = data.sheets;
          }
        }
      } catch (e) {
        console.log('Fetching /api/sheets/tabs failed, attempting client fallback...', e);
      }

      // 2. Fallback: If no sheets and token exists, call Google Sheets API directly
      if (sheets.length === 0 && token) {
        try {
          const meta = await fetchSpreadsheetMetadata(token);
          if (meta && Array.isArray(meta.sheets) && meta.sheets.length > 0) {
            sheets = meta.sheets;
          }
        } catch (e) {
          console.warn('Direct Google Sheets API metadata call failed:', e);
        }
      }

      // 3. Fallback: Client-side public HTML parsing fallback
      if (sheets.length === 0) {
        try {
          const publicTabs = await fetchPublicTabsFallback();
          if (publicTabs && publicTabs.length > 0) {
            sheets = publicTabs;
          }
        } catch (e) {
          console.warn('Public tabs fallback failed:', e);
        }
      }

      if (sheets.length > 0) {
        setTabs(sheets);
        
        // Select the latest tab (first one in the list)
        const firstSheetTitle = sheets[0].properties.title;
        if (!selectedTab || !sheets.find(s => s.properties.title === selectedTab)) {
          setSelectedTab(firstSheetTitle);
        }
      } else {
        throw new Error('ไม่พบข้อมูลแท็บ หรือเซิร์ฟเวอร์ยังไม่พร้อมใช้งาน หากตารางเป็นส่วนตัว กรุณาคลิก "เข้าสู่ระบบด้วย Google"');
      }
    } catch (err: any) {
      console.error('Failed to load tabs:', err);
      setError('ไม่สามารถโหลดรายการแท็บได้: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setLoading(false);
    }
  };

  // Helper function to clean date string and remove day of week prefix (e.g. พ. 5 ส.ค.69 -> 5 ส.ค.69)
  const cleanDateString = (rawDate: string): string => {
    if (!rawDate) return '';
    let str = rawDate
      .replace(/^สำเนาของ\s*/i, '')
      .replace(/^\(ต้นฉบับ\)\s*/i, '')
      .replace(/ประจำวันที่\s*/g, '')
      .replace(/วันที่\s*/g, '')
      .trim();
    
    // Remove day of week abbreviations at start (e.g., พฤ., พ., จ., อ., ศ., ส., อา. or full days)
    str = str.replace(/^(วัน)?(พฤ\.|พฤ|จ\.|จ|อ\.|อ|พ\.|พ|ศ\.|ศ|ส\.|ส|อา\.|อา)\s*/i, '').trim();
    return str;
  };

  const loadMeetings = async () => {
    if (!selectedTab) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      let rows: any[][] = [];

      // 1. Try server/serverless endpoint
      try {
        const response = await fetch(`/api/sheets/values?sheetTitle=${encodeURIComponent(selectedTab)}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (Array.isArray(data)) {
            rows = data;
          }
        }
      } catch (e) {
        console.log('Fetching /api/sheets/values failed, attempting direct public gviz fallback...', e);
      }

      // 2. Fallback: try public gviz query directly from browser
      if (rows.length === 0) {
        try {
          rows = await fetchPublicGvizValues(selectedTab);
        } catch (e) {
          console.log('Direct gviz query failed, attempting Google API with token...', e);
        }
      }

      // 3. Fallback: try Google Sheets API directly with access token
      if (rows.length === 0 && token) {
        try {
          rows = await fetchSheetData(token, selectedTab);
        } catch (e) {
          console.warn('Direct Google Sheets API fetchSheetData failed:', e);
        }
      }

      if (rows.length < 1) {
        setMeetings([]);
        return;
      }

      // Improved Parsing logic
      // Search for date in first 8 rows
      let dateVal = '';
      const dateKeywords = ['วันที่', 'ประจำวันที่', 'พ.ศ.'];
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        const rowText = rows[i].join(' ');
        if (dateKeywords.some(k => rowText.includes(k))) {
          dateVal = rows[i].find((c: any) => typeof c === 'string' && dateKeywords.some(k => c.includes(k))) || '';
          if (dateVal.length < 10) {
             dateVal = rows[i].join(' ');
          }
          break;
        }
      }
      
      // Find header row (row containing 'คณะ' or 'ชื่อ')
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const rowText = rows[i].join(' ');
        if (rowText.includes('คณะ') || rowText.includes('หน่วยงาน') || rowText.includes('ชื่อการประชุม')) {
          headerRowIndex = i;
          break;
        }
      }

      // Fallback date from tab title if not found in content
      const finalDate = cleanDateString(dateVal || selectedTab);
      
      const startDataRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1;
      
      const meetingList: MeetingData[] = rows.slice(startDataRow).map((row: any[], index: number) => {
        const seq = String(row[0] || '').trim();
        const time = String(row[1] || '').trim();
        const name = String(row[2] || '').trim();
        const reporter = String(row[3] || '').trim();
        const room = String(row[4] || '').trim();

        return {
          id: index,
          seq: seq || String(index + 1),
          name: name || 'ไม่มีชื่อการประชุม',
          time: time || 'ไม่ระบุเวลา',
          date: finalDate,
          reporter: reporter,
          room: room,
          raw: row
        };
      }).filter((m: MeetingData) => m.name !== 'ไม่มีชื่อการประชุม' && m.name.trim().length > 0 && !m.name.includes('ลงชื่อ'));

      setMeetings(meetingList);
    } catch (err: any) {
      console.error('Failed to load meetings:', err);
      setError('ไม่สามารถโหลดข้อมูลการประชุมได้: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsAuthLoading(true);
    try {
      await googleSignIn();
      loadTabs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTabs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTab) {
      loadMeetings();
      setSelectedMeetingId(null);
      setEpisode('');
    }
  }, [selectedTab]);

  useEffect(() => {
    if (selectedMeetingId !== null) {
      const meeting = meetings.find(m => m.id === selectedMeetingId);
      if (meeting) {
        setEpisode('');
        setCustomTime(meeting.time);
      }
    }
  }, [selectedMeetingId, meetings]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedSearchName(searchNameInput.trim());
    setAppliedSearchReporter(searchReporterInput.trim());
  };

  const handleClearSearch = () => {
    setSearchNameInput('');
    setSearchReporterInput('');
    setAppliedSearchName('');
    setAppliedSearchReporter('');
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const matchName = !appliedSearchName || m.name.toLowerCase().includes(appliedSearchName.toLowerCase());
      const matchReporter = !appliedSearchReporter || m.reporter.toLowerCase().includes(appliedSearchReporter.toLowerCase());
      return matchName && matchReporter;
    });
  }, [meetings, appliedSearchName, appliedSearchReporter]);

  const handleInsert = () => {
    if (selectedMeetingId === null) return;
    const meeting = meetings.find(m => m.id === selectedMeetingId);
    if (!meeting) return;

    // Format: [วันที่] [ชื่อการประชุม] ตอน [Episode] เวลา [Time] นาฬิกา
    const header = `${meeting.date} ${meeting.name} ตอน ${episode} เวลา ${customTime} นาฬิกา`;
    onInsert(header);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl text-green-600 shadow-sm">
              <Database size={22} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">พิมพ์ส่วนหัวจากการประชุม</h3>
              <p className="text-xs text-gray-500 font-medium">ดึงข้อมูลจาก Google Sheets ของคุณ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogin} 
              disabled={isAuthLoading}
              title="เข้าสู่ระบบด้วย Google"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-all"
            >
              {isAuthLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              <span>เข้าสู่ระบบ Google</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="flex-1">{error}</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleLogin}
                  disabled={isAuthLoading}
                  className="px-3 py-1 bg-white border border-red-200 hover:bg-red-50 text-red-800 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                >
                  {isAuthLoading ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
                  เข้าสู่ระบบ
                </button>
                <button 
                  onClick={() => { loadTabs(); if (selectedTab) loadMeetings(); }}
                  className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  ลองใหม่
                </button>
              </div>
            </div>
          )}
            <>
              {/* Select Tab Dropdown */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Database size={16} className="text-green-500" />
                  เลือกแท็บข้อมูล
                </label>
                <div className="relative">
                  <select
                    value={selectedTab}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all appearance-none bg-white font-medium text-gray-700"
                  >
                    {tabs.length === 0 ? (
                      <option disabled>ไม่พบข้อมูลแท็บ</option>
                    ) : (
                      tabs.map((tab) => (
                        <option key={tab.properties.sheetId} value={tab.properties.title}>
                          {tab.properties.title}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Episode & Time Edit (Visible when a meeting is selected) */}
              {selectedMeetingId !== null && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-2 gap-4 p-4 bg-green-50/30 border border-green-100 rounded-2xl"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 flex items-center gap-2">
                      <Hash size={14} className="text-green-500" />
                      ตอนที่
                    </label>
                    <input 
                      type="text"
                      value={episode}
                      onChange={(e) => setEpisode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-sm"
                      placeholder="ระบุตอน..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 flex items-center gap-2">
                      <ClockIcon size={14} className="text-blue-500" />
                      แก้ไขเวลา
                    </label>
                    <input 
                      type="text"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-sm"
                      placeholder="ระบุเวลา..."
                    />
                  </div>
                </motion.div>
              )}

              {/* Search Section */}
              <form onSubmit={handleSearch} className="p-4 bg-gray-50 border border-gray-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Search size={14} className="text-green-600" />
                    ค้นหาข้อมูลการประชุม
                  </span>
                  {(appliedSearchName || appliedSearchReporter || searchNameInput || searchReporterInput) && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
                    >
                      <X size={12} />
                      ล้างการค้นหา
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500">
                      ค้นหาด้วยชื่อการประชุม
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchNameInput}
                        onChange={(e) => setSearchNameInput(e.target.value)}
                        placeholder="พิมพ์ชื่อการประชุม..."
                        className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500">
                      ค้นหาจากชื่อผู้จดรายงาน
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchReporterInput}
                        onChange={(e) => setSearchReporterInput(e.target.value)}
                        placeholder="พิมพ์ชื่อผู้จดรายงาน..."
                        className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                      <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Search size={14} />
                    ค้นหา
                  </button>
                </div>
              </form>

              {/* Meetings List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Calendar size={16} className="text-orange-500" />
                    เลือกข้อมูลการประชุม
                  </label>
                  {(appliedSearchName || appliedSearchReporter) && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200/60">
                      พบ {filteredMeetings.length} จาก {meetings.length} รายการ
                    </span>
                  )}
                </div>
                <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50 min-h-[250px] max-h-[380px] overflow-y-auto shadow-inner">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Loader2 className="animate-spin mb-3 text-green-500" size={32} />
                      <p className="text-sm font-medium">กำลังดึงข้อมูลจากตาราง...</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-red-500 p-6 text-center">
                      <div className="bg-red-50 p-3 rounded-full mb-3">
                        <X size={24} />
                      </div>
                      <p className="text-sm font-bold mb-1">เกิดข้อผิดพลาด</p>
                      <p className="text-xs opacity-80 max-w-xs">{error}</p>
                      <button 
                        onClick={() => selectedTab ? loadMeetings() : loadTabs()}
                        className="mt-4 px-4 py-2 bg-white border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                      >
                        ลองใหม่อีกครั้ง
                      </button>
                    </div>
                  ) : meetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Database size={32} className="mb-2 opacity-20" />
                      <p className="text-sm">ไม่พบข้อมูลในแท็บนี้</p>
                    </div>
                  ) : filteredMeetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-2">
                      <Search size={32} className="opacity-20" />
                      <p className="text-sm font-medium">ไม่พบข้อมูลการประชุมที่ตรงกับการค้นหา</p>
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="text-xs text-green-600 underline font-semibold hover:text-green-700"
                      >
                        ล้างเงื่อนไขการค้นหา
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 bg-white">
                      {filteredMeetings.map((meeting) => (
                        <button
                          key={meeting.id}
                          onClick={() => setSelectedMeetingId(meeting.id)}
                          className={`w-full text-left p-5 transition-all hover:bg-gray-50 flex items-start justify-between gap-4 border-l-4 ${
                            selectedMeetingId === meeting.id 
                              ? 'bg-green-50/50 border-green-500' 
                              : 'border-transparent'
                          }`}
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded">
                                ลำดับ {meeting.seq}
                              </span>
                              <p className={`font-bold leading-snug ${selectedMeetingId === meeting.id ? 'text-green-900' : 'text-gray-900'}`}>
                                {meeting.name}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-gray-500">
                              <span className="flex items-center gap-1.5">
                                <ClockIcon size={14} className="text-gray-400" />
                                {meeting.time}
                              </span>
                              {meeting.reporter && (
                                <span className="flex items-center gap-1.5">
                                  <User size={14} className="text-gray-400" />
                                  {meeting.reporter}
                                </span>
                              )}
                              {meeting.room && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin size={14} className="text-gray-400" />
                                  {meeting.room}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            selectedMeetingId === meeting.id 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-200'
                          }`}>
                            {selectedMeetingId === meeting.id && (
                              <Check size={14} className="stroke-[3]" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500 max-w-[280px] w-full">
            {selectedMeetingId !== null && meetings.find(m => m.id === selectedMeetingId) && (
              <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <p className="font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">ตัวอย่างส่วนหัว:</p>
                <p className="italic text-gray-700 line-clamp-1">
                  {meetings.find(m => m.id === selectedMeetingId)?.date} {meetings.find(m => m.id === selectedMeetingId)?.name} ตอน {episode} เวลา {customTime} นาฬิกา
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              ยกเลิก
            </button>
            <button 
              onClick={handleInsert}
              disabled={selectedMeetingId === null || loading}
              className="flex-1 sm:flex-none px-8 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-100 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              พิมพ์ลงในเอกสาร
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};


