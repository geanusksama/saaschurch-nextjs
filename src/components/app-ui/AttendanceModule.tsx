"use client";

import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Download, Search, Trash2, ChevronLeft, ChevronRight, 
  RefreshCw, User, Calendar, Printer, MessageSquare, BarChart2, List, FileText,
  Cpu
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '../../design-system/components/Badge';
import { ConfirmDialog } from './shared/ConfirmDialog';
import * as XLSX from 'xlsx';

// Interfaces
interface FacePresenceRecord {
  id: string;
  rol: number | null;
  nome: string;
  cargo: string | null;
  horario: string;
  confianca: number | null;
  camera: string | null;
  igrejaRegional: string | null;
  campo: string | null;
  dataRegistro: string;
}

interface MemberRow {
  id: string;
  fullName: string;
  rol: number | null;
  phone?: string | null;
  membershipStatus?: string | null;
  ecclesiasticalTitle?: string | null;
}

// Helpers for Date & Time calculation
const getStartOfMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01T00:00`;
};

const getEndOfMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthStr = String(month + 1).padStart(2, '0');
  return `${year}-${monthStr}-${lastDay}T23:59`;
};

const getDayOfWeek = (dateStr: string) => {
  const date = new Date(dateStr);
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[date.getDay()];
};

const getPeriod = (dateStr: string) => {
  const date = new Date(dateStr);
  const hours = date.getHours();
  return hours < 13 ? 'Manhã' : 'Noite';
};

const getWeeksInPeriod = (deDateStr: string, ateDateStr: string) => {
  const deDate = new Date(deDateStr);
  const ateDate = new Date(ateDateStr);
  
  const weeks: { start: Date; end: Date; label: string }[] = [];
  let currentStart = new Date(deDate);
  let weekNum = 1;
  
  while (currentStart < ateDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 6);
    currentEnd.setHours(23, 59, 59, 999);
    
    const displayEnd = currentEnd > ateDate ? ateDate : currentEnd;
    const label = `Semana ${weekNum} (${currentStart.getDate()}/${currentStart.getMonth() + 1} a ${displayEnd.getDate()}/${displayEnd.getMonth() + 1})`;
    
    weeks.push({
      start: new Date(currentStart),
      end: new Date(displayEnd),
      label
    });
    
    currentStart.setDate(currentStart.getDate() + 7);
    weekNum++;
  }
  
  return weeks;
};

const getMonthsInPeriod = (deDateStr: string, ateDateStr: string) => {
  const deDate = new Date(deDateStr);
  const ateDate = new Date(ateDateStr);
  
  const months: { label: string; year: number; monthIndex: number }[] = [];
  let current = new Date(deDate.getFullYear(), deDate.getMonth(), 1);
  
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  
  while (current <= ateDate) {
    const yearStr = String(current.getFullYear()).slice(-2);
    const label = `${monthNames[current.getMonth()]}/${yearStr}`;
    
    months.push({
      label,
      year: current.getFullYear(),
      monthIndex: current.getMonth()
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
};

const getWeeklyBehavior = (memberRecords: FacePresenceRecord[], deDateStr: string, ateDateStr: string) => {
  const deDate = new Date(deDateStr);
  const ateDate = new Date(ateDateStr);
  
  const weeks: { label: string; presences: number; status: 'Presente' | 'Ausente' }[] = [];
  let currentStart = new Date(deDate);
  let weekNum = 1;
  
  while (currentStart < ateDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 6);
    currentEnd.setHours(23, 59, 59, 999);
    
    const displayEnd = currentEnd > ateDate ? ateDate : currentEnd;
    const label = `Semana ${weekNum} (${currentStart.getDate()}/${currentStart.getMonth() + 1} a ${displayEnd.getDate()}/${displayEnd.getMonth() + 1})`;
    
    const presences = memberRecords.filter(r => {
      const recordDate = new Date(r.horario);
      return recordDate >= currentStart && recordDate <= displayEnd;
    }).length;
    
    weeks.push({
      label,
      presences,
      status: presences > 0 ? 'Presente' : 'Ausente'
    });
    
    currentStart.setDate(currentStart.getDate() + 7);
    weekNum++;
  }
  
  return weeks;
};

export function AttendanceModule() {
  const token = localStorage.getItem('mrm_token');

  // Navigation tabs (5 Tabs)
  const [activeTab, setActiveTab] = useState<'general' | 'member_history' | 'insights' | 'report' | 'devices'>('general');

  // Confirmation dialog state
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Default date filters initialized to start & end of current month
  const [de, setDe] = useState(getStartOfMonth());
  const [ate, setAte] = useState(getEndOfMonth());

  // --- Church Selector State ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [churches, setChurches] = useState<any[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string>('');

  // --- Tab 1: General Presence State ---
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [generalData, setGeneralData] = useState<FacePresenceRecord[]>([]);
  const [generalTotal, setGeneralTotal] = useState(0);
  const [loadingGeneral, setLoadingGeneral] = useState(false);

  // --- Tab 2: Member History State ---
  const [memberSearch, setMemberSearch] = useState('');
  const [searchedMembers, setSearchedMembers] = useState<MemberRow[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [memberRecords, setMemberRecords] = useState<FacePresenceRecord[]>([]);
  const [loadingMember, setLoadingMember] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);

  // --- Tab 3: Insights State ---
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsData, setInsightsData] = useState<FacePresenceRecord[]>([]);
  const [allMembers, setAllMembers] = useState<MemberRow[]>([]);

  // --- Tab 4: Report State ---
  const [selectedRegionalId, setSelectedRegionalId] = useState<string>('all');
  const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
  const [selectedTitleIds, setSelectedTitleIds] = useState<string[]>([]);
  const [selectedSituacao, setSelectedSituacao] = useState<string>('Todos');
  const [reportMembers, setReportMembers] = useState<any[]>([]);
  const [selectedReportMemberIds, setSelectedReportMemberIds] = useState<string[]>([]);
  const [reportMonths, setReportMonths] = useState<any[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [regionais, setRegionais] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);

  // --- Tab 5: Devices State ---
  const [devices, setDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [deviceSerial, setDeviceSerial] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceUsername, setDeviceUsername] = useState('');
  const [devicePassword, setDevicePassword] = useState('');
  const [deviceChurchId, setDeviceChurchId] = useState('');

  // Load devices list
  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const params = new URLSearchParams();
      if (selectedChurchId && selectedChurchId !== 'all') {
        params.set("churchId", selectedChurchId);
      }
      const res = await fetch(`/api/face-devices?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dispositivos:", err);
    } finally {
      setLoadingDevices(false);
    }
  };

  // Open modal for creating a new device
  const handleNewDevice = () => {
    setEditingDevice(null);
    setDeviceSerial('');
    setDeviceName('');
    setDeviceUsername('');
    setDevicePassword('');
    setDeviceChurchId(selectedChurchId !== 'all' ? selectedChurchId : (churches[0]?.id || ''));
    setShowDeviceModal(true);
  };

  // Open modal for editing a device
  const handleEditDevice = (dev: any) => {
    setEditingDevice(dev);
    setDeviceSerial(dev.serial);
    setDeviceName(dev.name);
    setDeviceUsername(dev.username || '');
    setDevicePassword(dev.password || '');
    setDeviceChurchId(dev.churchId);
    setShowDeviceModal(true);
  };

  // Save device (Create or Edit)
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceSerial.trim() || !deviceName.trim() || !deviceChurchId) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const payload = {
      serial: deviceSerial.trim(),
      name: deviceName.trim(),
      username: deviceUsername.trim() || null,
      password: devicePassword.trim() || null,
      churchId: deviceChurchId
    };

    try {
      const url = editingDevice ? `/api/face-devices/${editingDevice.id}` : `/api/face-devices`;
      const method = editingDevice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ocorreu um erro ao salvar o dispositivo.");
      }

      setShowDeviceModal(false);
      loadDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete device
  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este dispositivo?")) {
      return;
    }

    try {
      const res = await fetch(`/api/face-devices/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao remover dispositivo.");
      }

      loadDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleSelectMember = (id: string) => {
    setSelectedReportMemberIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllMembers = () => {
    if (selectedReportMemberIds.length === reportMembers.length) {
      setSelectedReportMemberIds([]);
    } else {
      setSelectedReportMemberIds(reportMembers.map(m => m.id));
    }
  };

  // Multi-select dropdowns visibility states
  const [showChurchesDropdown, setShowChurchesDropdown] = useState(false);
  const [showTitlesDropdown, setShowTitlesDropdown] = useState(false);
  const [churchSearch, setChurchSearch] = useState('');

  // Filter churches by selected regional locally
  const filteredChurches = React.useMemo(() => {
    let list = churches;
    if (selectedRegionalId && selectedRegionalId !== 'all') {
      list = churches.filter(c => c.regionalId === selectedRegionalId);
    }
    if (churchSearch.trim()) {
      list = list.filter(c => c.name.toLowerCase().includes(churchSearch.toLowerCase()));
    }
    return list;
  }, [churches, selectedRegionalId, churchSearch]);

  // Reset selected churches when regional changes
  useEffect(() => {
    setSelectedChurchIds([]);
  }, [selectedRegionalId]);

  // Load User, Churches, Regionals, and Titles on mount
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('mrm_user') || '{}');
      setCurrentUser(user);
      
      const fetchInitialData = async () => {
        try {
          // Fetch churches
          const res = await fetch('/api/churches', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            setChurches(data);
            
            if (user.churchId) {
              setSelectedChurchId(user.churchId);
            } else if (data.length > 0) {
              if (user.profileType === 'master') {
                setSelectedChurchId('all');
              } else {
                setSelectedChurchId(data[0].id);
              }
            }
          }

          // Fetch regionais
          const resRegionals = await fetch('/api/regionais', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (resRegionals.ok) {
            const dataReg = await resRegionals.json();
            setRegionais(dataReg);
          }

          // Fetch ecclesiastical titles
          const resTitles = await fetch('/api/ecclesiastical-titles', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (resTitles.ok) {
            const dataTitles = await resTitles.json();
            setTitles(dataTitles);
          }
        } catch (e) {
          console.error("Erro ao carregar dados iniciais:", e);
        }
      };
      
      fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch general check-ins (Aba 1)
  const loadGeneralPresences = async () => {
    setLoadingGeneral(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (rol) params.set("rol", rol);
      if (de) params.set("de", de);
      if (ate) params.set("ate", ate);
      if (selectedChurchId) params.set("churchId", selectedChurchId);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/face-presence?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setGeneralData(json.data || []);
        setGeneralTotal(json.total || 0);
      }
    } catch (err) {
      console.error("Erro ao carregar presenças gerais:", err);
    } finally {
      setLoadingGeneral(false);
    }
  };

  // Search members in saasChurch database (Aba 2)
  const searchMembers = async (text: string) => {
    if (!text.trim()) {
      setSearchedMembers([]);
      return;
    }
    setSearchingMembers(true);
    try {
      const params = new URLSearchParams();
      params.set("q", text);
      if (selectedChurchId && selectedChurchId !== 'all') {
        params.set("churchId", selectedChurchId);
      }
      const res = await fetch(`/api/members?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setSearchedMembers(json.data || []);
      }
    } catch (err) {
      console.error("Erro ao buscar membros:", err);
    } finally {
      setSearchingMembers(false);
    }
  };

  // Load selected member records and month base records
  const loadMemberHistory = async (member: MemberRow) => {
    setLoadingMember(true);
    try {
      // 1. Fetch checkins for this specific member
      const params = new URLSearchParams();
      if (member.rol) {
        params.set("rol", String(member.rol));
      } else {
        params.set("q", member.fullName);
      }
      params.set("de", de);
      params.set("ate", ate);
      if (selectedChurchId) params.set("churchId", selectedChurchId);
      params.set("pageSize", "500");

      const resMember = await fetch(`/api/face-presence?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (resMember.ok) {
        const jsonMember = await resMember.json();
        
        // Filter exactly by member rol or name to ensure clean member records
        const filteredMemberCheckins = (jsonMember.data || []).filter((r: FacePresenceRecord) => {
          const matchRol = member.rol && r.rol && String(r.rol) === String(member.rol);
          const matchName = r.nome && member.fullName && r.nome.toUpperCase().trim() === member.fullName.toUpperCase().trim();
          return matchRol || matchName;
        });
        
        setMemberRecords(filteredMemberCheckins);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico do membro:", err);
    } finally {
      setLoadingMember(false);
    }
  };

  // Load insights data (Aba 3)
  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      // Load all presence records for the period
      const params = new URLSearchParams();
      params.set("de", de);
      params.set("ate", ate);
      if (selectedChurchId) params.set("churchId", selectedChurchId);
      params.set("pageSize", "2000");

      const resPresences = await fetch(`/api/face-presence?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // Load list of members to match who is absent
      const memberParams = new URLSearchParams();
      memberParams.set("pageSize", "150");
      if (selectedChurchId && selectedChurchId !== 'all') {
        memberParams.set("churchId", selectedChurchId);
      }
      const resMembers = await fetch(`/api/members?${memberParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (resPresences.ok && resMembers.ok) {
        const jsonPresences = await resPresences.json();
        const jsonMembers = await resMembers.json();
        
        setInsightsData(jsonPresences.data || []);
        setAllMembers(jsonMembers.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar insights:", err);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Generate complete attendance report (Aba 4)
  const generateReport = async () => {
    setGeneratingReport(true);
    try {
      const memberParams = new URLSearchParams();
      memberParams.set("pageSize", "3000");
      
      if (selectedRegionalId && selectedRegionalId !== 'all') {
        memberParams.set("regionalId", selectedRegionalId);
      }
      
      if (selectedChurchIds.length > 0) {
        memberParams.set("churchIds", selectedChurchIds.join(','));
      }
      
      if (selectedTitleIds.length > 0) {
        memberParams.set("titleId", selectedTitleIds.join(','));
      }

      const resMembers = await fetch(`/api/members?${memberParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!resMembers.ok) throw new Error("Erro ao buscar membros");
      const jsonMembers = await resMembers.json();
      const membersList = jsonMembers.data || [];

      const presenceParams = new URLSearchParams();
      presenceParams.set("de", de);
      presenceParams.set("ate", ate);
      presenceParams.set("pageSize", "5000");
      
      const resPresence = await fetch(`/api/face-presence?${presenceParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!resPresence.ok) throw new Error("Erro ao buscar presenças");
      const jsonPresence = await resPresence.json();
      const checkins = jsonPresence.data || [];

      const weeks = getWeeksInPeriod(de, ate);
      const months = getMonthsInPeriod(de, ate);
      
      const processed = membersList.map((member: any) => {
        const memberCheckins = checkins.filter((r: any) => {
          const matchRol = member.rol && r.rol && String(r.rol) === String(member.rol);
          const matchName = r.nome && member.fullName && r.nome.toUpperCase().trim() === member.fullName.toUpperCase().trim();
          return matchRol || matchName;
        });

        let presenceWeeksCount = 0;
        weeks.forEach((w) => {
          const hasPresence = memberCheckins.some((r: any) => {
            const date = new Date(r.horario);
            return date >= w.start && date <= w.end;
          });
          if (hasPresence) presenceWeeksCount++;
        });

        const totalWeeks = weeks.length || 1;
        const absences = Math.max(0, totalWeeks - presenceWeeksCount);
        
        const sortedCheckins = [...memberCheckins].sort((a, b) => new Date(b.horario).getTime() - new Date(a.horario).getTime());
        const lastSeenDate = sortedCheckins.length > 0 
          ? new Date(sortedCheckins[0].horario).toLocaleDateString('pt-BR') 
          : '—';

        const monthPresenceMap: Record<string, boolean> = {};
        months.forEach((m) => {
          const hasPresenceInMonth = memberCheckins.some((r: any) => {
            const date = new Date(r.horario);
            return date.getFullYear() === m.year && date.getMonth() === m.monthIndex;
          });
          monthPresenceMap[m.label] = hasPresenceInMonth;
        });

        let situacao = "Inconstante";
        if (presenceWeeksCount === totalWeeks) {
          situacao = "Constante";
        } else if (presenceWeeksCount === 0) {
          situacao = "Ausente";
        }

        return {
          id: member.id,
          rol: member.rol,
          fullName: member.fullName,
          cargo: member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle || 'Membro',
          igreja: member.church?.name || '—',
          situacao,
          comparecimentoStr: `${presenceWeeksCount}/${totalWeeks}`,
          absences,
          lastSeenDate,
          monthPresenceMap
        };
      });

      const filteredResult = selectedSituacao === 'Todos'
        ? processed
        : processed.filter((p: any) => p.situacao === selectedSituacao);

      setReportMembers(filteredResult);
      setSelectedReportMemberIds(filteredResult.map((m: any) => m.id));
      setReportMonths(months);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setGeneratingReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'general') {
      loadGeneralPresences();
    } else if (activeTab === 'insights') {
      loadInsights();
    } else if (activeTab === 'member_history' && selectedMember) {
      loadMemberHistory(selectedMember);
    } else if (activeTab === 'devices') {
      loadDevices();
    }
  }, [activeTab, page, selectedChurchId]);

  const handleGeneralSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadGeneralPresences();
  };

  const handleClearGeneralFilters = () => {
    setQ('');
    setRol('');
    setSelectedDayOfWeek('');
    setDe(getStartOfMonth());
    setAte(getEndOfMonth());
    setPage(1);
    setTimeout(() => {
      loadGeneralPresences();
    }, 50);
  };

  const handleMemberSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchMembers(memberSearch);
  };

  // Autocomplete member select (Aba 2)
  const handleSelectMember = (member: MemberRow) => {
    setSelectedMember(member);
    setSearchedMembers([]);
    setMemberSearch(`${member.rol ? `[${member.rol}] ` : ''}${member.fullName}`);
    loadMemberHistory(member);
  };

  // Calculate Member Insights (Aba 2)
  const memberInsights = React.useMemo(() => {
    if (!selectedMember) return null;

    // Days this member checked in
    const uniqueMemberDays = Array.from(new Set(memberRecords.map(r => new Date(r.horario).toDateString())));
    const memberAttendanceCount = uniqueMemberDays.length;

    // Last presence
    const lastPresence = memberRecords.length > 0 
      ? new Date(memberRecords[0].horario).toLocaleString('pt-BR') 
      : 'Nunca registrado';

    // Day of the week most attended
    const dayCounts: Record<string, number> = {};
    memberRecords.forEach(r => {
      const day = getDayOfWeek(r.horario);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    let bestDay = '—';
    let maxDayCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        bestDay = day;
      }
    });

    // Time/period most attended
    let morningCount = 0;
    let nightCount = 0;
    memberRecords.forEach(r => {
      if (getPeriod(r.horario) === 'Manhã') morningCount++;
      else nightCount++;
    });
    const bestPeriod = morningCount === 0 && nightCount === 0 
      ? '—' 
      : morningCount > nightCount ? 'Manhã' : 'Noite';

    // Weekly behavior
    const weeklyBehavior = getWeeklyBehavior(memberRecords, de, ate);
    const absencesCount = weeklyBehavior.filter(w => w.status === 'Ausente').length;
    const presenceWeeksCount = weeklyBehavior.filter(w => w.status === 'Presente').length;
    const totalWeeks = weeklyBehavior.length || 1;

    // Attendance rate relative to total weeks in the reference period
    const rate = Math.min(100, Math.round((presenceWeeksCount / totalWeeks) * 100));

    return {
      rate,
      attendanceCount: memberAttendanceCount,
      lastPresence,
      bestDay,
      bestPeriod,
      weeklyBehavior,
      absencesCount
    };
  }, [selectedMember, memberRecords, de, ate]);

  // Calculate General Insights (Aba 3)
  const generalInsights = React.useMemo(() => {
    if (insightsData.length === 0) return null;

    // Checkins by Day of Week
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayCounts: Record<string, number> = {};
    days.forEach(d => { dayCounts[d] = 0; });
    
    insightsData.forEach(r => {
      const day = getDayOfWeek(r.horario);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    const dayChartData = days.map(d => ({
      name: d.split('-')[0], // Shorten "Segunda-feira" to "Segunda"
      'Presenças': dayCounts[d]
    }));

    // Find day with highest attendance
    let highestDay = '—';
    let maxDayCount = -1;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        highestDay = day;
      }
    });

    // Period distribution
    let morning = 0;
    let night = 0;
    insightsData.forEach(r => {
      if (getPeriod(r.horario) === 'Manhã') morning++;
      else night++;
    });

    const periodChartData = [
      { name: 'Manhã', 'Presenças': morning },
      { name: 'Noite', 'Presenças': night }
    ];

    // Absent members (Absent for more than 1 service/culto)
    // Unique service days in the period
    const serviceDays = Array.from(new Set(insightsData.map(r => new Date(r.horario).toDateString())));
    
    const absentMembers = allMembers.map(member => {
      const checkins = insightsData.filter(r => {
        const matchRol = member.rol && r.rol && String(r.rol) === String(member.rol);
        const matchName = r.nome && member.fullName && r.nome.toUpperCase().trim() === member.fullName.toUpperCase().trim();
        return matchRol || matchName;
      });
      const uniqueDays = Array.from(new Set(checkins.map(r => new Date(r.horario).toDateString()))).length;
      const missedCount = Math.max(0, serviceDays.length - uniqueDays);

      return {
        ...member,
        presenceCount: uniqueDays,
        absenceCount: missedCount,
        lastSeen: checkins.length > 0 ? new Date(checkins[0].horario).toLocaleDateString('pt-BR') : 'Nunca'
      };
    })
    .filter(m => m.absenceCount > 1) // Absent for more than 1 service
    .sort((a, b) => b.absenceCount - a.absenceCount); // Sort by highest absences

    return {
      dayChartData,
      periodChartData,
      highestDay,
      absentMembers,
      totalCheckins: insightsData.length
    };
  }, [insightsData, allMembers]);

  // General table data client-side day-of-week filtering
  const filteredGeneralData = React.useMemo(() => {
    if (!selectedDayOfWeek) return generalData;
    return generalData.filter(r => getDayOfWeek(r.horario) === selectedDayOfWeek);
  }, [generalData, selectedDayOfWeek]);

  // General Excel Export
  const exportToExcel = () => {
    if (generalData.length === 0) return;
    
    const data = generalData.map((r, i) => ({
      'ROL': r.rol || '',
      'Nome': r.nome,
      'Cargo': r.cargo || '',
      'Dia da Semana': getDayOfWeek(r.horario),
      'Período': getPeriod(r.horario),
      'Horário': new Date(r.horario).toLocaleString('pt-BR'),
      'Confiança': r.confianca ? `${Math.round(r.confianca * 100)}%` : '',
      'Câmera': r.camera || '',
      'Igreja Regional': r.igrejaRegional || '',
      'Campo': r.campo || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 8 },  // ROL
      { wch: 35 }, // Nome
      { wch: 20 }, // Cargo
      { wch: 15 }, // Dia da Semana
      { wch: 10 }, // Período
      { wch: 20 }, // Horário
      { wch: 12 }, // Confiança
      { wch: 25 }, // Câmera
      { wch: 25 }, // Igreja Regional
      { wch: 40 }, // Campo
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presenças');
    XLSX.writeFile(wb, `presencas-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Report Frequency Excel Export
  const exportReportToExcel = () => {
    if (reportMembers.length === 0) return;

    // Filter only selected members
    const selectedMembers = reportMembers.filter(m => selectedReportMemberIds.includes(m.id));
    if (selectedMembers.length === 0) {
      alert("Nenhum membro selecionado para exportação.");
      return;
    }

    const data = selectedMembers.map((member) => {
      const row: Record<string, any> = {
        'ROL': member.rol || '',
        'Nome': member.fullName,
        'Cargo': member.cargo || '',
        'Igreja': member.igreja || '',
        'Situação': member.situacao || '',
        'Com/Total': member.comparecimentoStr,
        'Falta': member.absences,
        'Última Presença': member.lastSeenDate,
      };

      // Add dynamic month presence
      reportMonths.forEach((m) => {
        row[m.label] = member.monthPresenceMap[m.label] ? '✓' : 'X';
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    const cols = [
      { wch: 8 },  // ROL
      { wch: 35 }, // Nome
      { wch: 20 }, // Cargo
      { wch: 25 }, // Igreja
      { wch: 15 }, // Situação
      { wch: 12 }, // Com/Total
      { wch: 8 },  // Falta
      { wch: 15 }, // Última Presença
    ];
    reportMonths.forEach(() => {
      cols.push({ wch: 10 });
    });
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Frequência');
    XLSX.writeFile(wb, `relatorio-presenca-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // General CSV Export
  const exportToCSV = () => {
    if (generalData.length === 0) return;
    const headers = ["ROL", "Nome", "Cargo", "Dia da Semana", "Periodo", "Horario", "Confianca", "Camera", "Igreja Regional", "Campo"];
    const rows = generalData.map((r) => [
      r.rol || "",
      r.nome,
      r.cargo || "",
      getDayOfWeek(r.horario),
      getPeriod(r.horario),
      new Date(r.horario).toLocaleString("pt-BR"),
      r.confianca ? `${Math.round(r.confianca * 100)}%` : "",
      r.camera || "",
      r.igrejaRegional || "",
      r.campo || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `presencas-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete presence record from general list
  const handleDeletePresence = (id: string) => {
    setPendingConfirm({
      title: "Excluir registro de presença",
      message: "Tem certeza que deseja excluir este registro de presença?",
      onConfirm: async () => {
        const res = await fetch(`/api/face-presence/${id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao remover registro de presença.");
        }

        loadGeneralPresences();
      }
    });
  };

  // Delete presence record from individual history report list
  const handleDeletePresenceFromHistory = (id: string) => {
    setPendingConfirm({
      title: "Excluir registro de presença",
      message: "Tem certeza que deseja excluir este registro de presença?",
      onConfirm: async () => {
        const res = await fetch(`/api/face-presence/${id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao remover registro de presença.");
        }

        if (selectedMember) {
          loadMemberHistory(selectedMember);
        }
      }
    });
  };

  // Send WhatsApp message to absent member
  const sendWhatsAppMessage = (phone: string | null | undefined, name: string) => {
    if (!phone) {
      alert("Telefone não cadastrado para este membro!");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `Olá ${name}, sentimos sua falta nos últimos cultos! Esperamos ver você em breve. Deus abençoe!`;
    const url = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* CSS style block for clean print styling (Aba 2) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/40 rounded-xl flex items-center justify-center">
            <CheckSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Presença Facial</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerenciamento e histórico de presenças por reconhecimento facial</p>
          </div>
        </div>
        
        {/* Navigation Tabs (4 Tabs) */}
        <div className="flex bg-white dark:bg-slate-850 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <List className="w-4 h-4" />
            Presença Geral
          </button>
          <button
            onClick={() => setActiveTab('member_history')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'member_history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Histórico do Membro
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'report'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Relatório de Presença
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'insights'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Gráficos e Insights
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'devices'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Dispositivos Face ID
          </button>
        </div>
      </div>
      {/* Date Interval filter (Shared - shown in all tabs except report, default set to current month) */}
      {activeTab !== 'report' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>Filtros Gerais de Pesquisa (Datas e Igreja):</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Church Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Igreja:</span>
              <select
                value={selectedChurchId}
                onChange={(e) => {
                  setSelectedChurchId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm dark:text-slate-100 text-slate-700 focus:outline-none"
              >
                {currentUser?.profileType === "master" && (
                  <option value="all">Todas as Igrejas</option>
                )}
                {churches.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">De:</span>
              <input
                type="datetime-local"
                value={de}
                onChange={(e) => {
                  setDe(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm dark:text-slate-100 text-slate-700 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Até:</span>
              <input
                type="datetime-local"
                value={ate}
                onChange={(e) => {
                  setAte(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm dark:text-slate-100 text-slate-700 focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                if (activeTab === 'general') loadGeneralPresences();
                else if (activeTab === 'insights') loadInsights();
                else if (selectedMember) loadMemberHistory(selectedMember);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 1: GENERAL PRESENCE LIST ─── */}
      {activeTab === 'general' && (
        <div className="space-y-6 no-print">
          
          {/* Filters Form */}
          <form onSubmit={handleGeneralSearch} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              
              {/* Nome */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Buscar por nome</label>
                <input
                  type="text"
                  placeholder="Ex: Francisco"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650"
                />
              </div>

              {/* ROL */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ROL</label>
                <input
                  type="text"
                  placeholder="Ex: 27269"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650"
                />
              </div>

              {/* Dia da Semana */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Dia da Semana</label>
                <select
                  value={selectedDayOfWeek}
                  onChange={(e) => setSelectedDayOfWeek(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 text-slate-700"
                >
                  <option value="">Todos os dias</option>
                  <option value="Domingo">Domingo</option>
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-2">
                <button
                  type="submit"
                  disabled={loadingGeneral}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors h-[38px] disabled:opacity-60"
                >
                  {loadingGeneral ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Filtrar Lista
                </button>
                <button
                  type="button"
                  onClick={handleClearGeneralFilters}
                  className="flex items-center justify-center border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm p-2 rounded-lg transition-colors h-[38px] w-[38px]"
                  title="Limpar filtros"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={exportToCSV}
                  disabled={filteredGeneralData.length === 0}
                  className="flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg border border-slate-750 transition-colors disabled:opacity-40"
                  title="Exportar CSV"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button 
                  type="button"
                  onClick={exportToExcel}
                  disabled={filteredGeneralData.length === 0}
                  className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm px-4 py-2 rounded-lg border border-green-800 transition-colors disabled:opacity-40"
                  title="Exportar Excel"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
              </div>
            </div>
          </form>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Registros Gerais</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Exibindo <strong>{filteredGeneralData.length}</strong> de <strong>{generalTotal}</strong> registros
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold">
                  <tr>
                    <th className="px-6 py-4">ROL</th>
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Cargo</th>
                    <th className="px-6 py-4">Dia da Semana</th>
                    <th className="px-6 py-4">Período</th>
                    <th className="px-6 py-4">Horário</th>
                    <th className="px-6 py-4">Confiança</th>
                    <th className="px-6 py-4">Câmera</th>
                    <th className="px-6 py-4">Igreja Regional</th>
                    <th className="px-6 py-4">Campo</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm text-slate-600 dark:text-slate-400">
                  {filteredGeneralData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-8 text-center text-slate-500 dark:text-slate-500">
                        {loadingGeneral ? "Carregando registros..." : "Nenhum registro de presença facial encontrado."}
                      </td>
                    </tr>
                  ) : (
                    filteredGeneralData.map((record) => {
                      const conf = record.confianca ? Math.round(record.confianca * 100) : 0;
                      let badgeVariant: 'success' | 'warning' | 'error' = 'success';
                      if (conf < 50) badgeVariant = 'error';
                      else if (conf < 70) badgeVariant = 'warning';

                      const period = getPeriod(record.horario);

                      return (
                        <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/20 transition-colors">
                          <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400 font-mono">
                            {record.rol || <span className="text-slate-350 dark:text-slate-700">—</span>}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                            {record.nome}
                          </td>
                          <td className="px-6 py-4">
                            {record.cargo || <span className="text-slate-350 dark:text-slate-700">—</span>}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {getDayOfWeek(record.horario)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              period === 'Manhã' 
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' 
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                            }`}>
                              {period}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {new Date(record.horario).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4">
                            {record.confianca ? (
                              <Badge variant={badgeVariant}>{conf}%</Badge>
                            ) : (
                              <span className="text-slate-350 dark:text-slate-700">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono text-xs">
                              {record.camera || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {record.igrejaRegional || <span className="text-slate-350 dark:text-slate-700">—</span>}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-400">
                            {record.campo || '—'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDeletePresence(record.id)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1"
                              title="Excluir registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {generalTotal > pageSize && (
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-sm bg-slate-50/50 dark:bg-slate-950/20">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <span className="text-slate-500 dark:text-slate-400 font-mono">
                  Página {page} de {Math.ceil(generalTotal / pageSize)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= generalTotal}
                  className="flex items-center gap-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors disabled:cursor-not-allowed"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      )}


      {/* ─── TAB 2: MEMBER SEARCH & DETAILED PRINTABLE REPORT ─── */}
      {activeTab === 'member_history' && (
        <div className="space-y-6">
          
          {/* Search Bar (Invisible when printing) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 no-print">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              Pesquisar Histórico Individual do Membro
            </h3>
            <form onSubmit={handleMemberSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar por Nome ou ROL do membro..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />

                {/* Autocomplete Dropdown list */}
                {searchedMembers.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {searchedMembers.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => handleSelectMember(m)}
                        className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex justify-between items-center text-sm text-slate-700 dark:text-slate-355"
                      >
                        <div>
                          <span className="font-bold text-blue-600 dark:text-blue-400 font-mono mr-2">
                            {m.rol ? `ROL: ${m.rol}` : 'S/ ROL'}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{m.fullName}</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {m.ecclesiasticalTitle || 'Membro'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={searchingMembers}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
              >
                {searchingMembers ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Buscar
              </button>
            </form>
          </div>

          {/* Detailed Printable Report View */}
          {selectedMember ? (
            loadingMember ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 font-medium no-print">
                Carregando relatório do membro...
              </div>
            ) : memberInsights ? (
              <div className="space-y-6">
                
                {/* Print Control Header (Invisible when printing) */}
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/60 p-4 rounded-xl no-print">
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    Relatório gerado com sucesso. Use o botão ao lado para imprimir ou salvar como PDF.
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Relatório
                  </button>
                </div>

                {/* Printable Document Sheet Card */}
                <div className="printable-report bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-md space-y-6">
                  
                  {/* Report Document Header */}
                  <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wide">
                        saasChurch - Gestão Ministerial
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold uppercase">
                        Relatório Detalhado de Frequência Individual
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500 font-mono">
                      <div>Gerado em: {new Date().toLocaleDateString('pt-BR')}</div>
                      <div>Período: {new Date(de).toLocaleDateString('pt-BR')} até {new Date(ate).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>

                  {/* Member Details Header Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-lg border border-slate-150 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Nome Completo</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">{selectedMember.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">ROL</span>
                      <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                        {selectedMember.rol || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Cargo / Função</span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedMember.ecclesiasticalTitle || 'Membro'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Status Eclesiástico</span>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">
                        {selectedMember.membershipStatus || 'ATIVO'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Indicators Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-lg text-center bg-white dark:bg-slate-950">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Frequência no Mês</span>
                      <span className={`text-2xl font-black block mt-1 ${
                        memberInsights.rate >= 75 ? 'text-green-600 dark:text-green-400' : 
                        memberInsights.rate >= 50 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {memberInsights.rate}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-medium block mt-0.5">
                        ({memberInsights.attendanceCount} presenças)
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-lg text-center bg-white dark:bg-slate-950">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Ausências</span>
                      <span className={`text-2xl font-black block mt-1 ${
                        memberInsights.absencesCount > 1 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {memberInsights.absencesCount}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-medium block mt-0.5">
                        semanas sem registro
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-lg text-center bg-white dark:bg-slate-950">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Última Presença</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block mt-2 whitespace-normal leading-tight">
                        {memberInsights.lastPresence}
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-lg text-center bg-white dark:bg-slate-950">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Dia mais Frequente</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block mt-3 font-medium">
                        {memberInsights.bestDay}
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-lg text-center bg-white dark:bg-slate-950">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Período mais Comum</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block mt-3 font-medium">
                        {memberInsights.bestPeriod}
                      </span>
                    </div>
                  </div>

                  {/* Absences Check Action (Only shown in UI, hidden when printing) */}
                  {memberInsights.absencesCount > 1 && (
                    <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/40 p-4 rounded-xl no-print">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="text-sm text-red-800 dark:text-red-300 font-semibold">
                          Atenção: Este membro faltou a mais de um culto no período selecionado!
                        </span>
                      </div>
                      <button
                        onClick={() => sendWhatsAppMessage(selectedMember.phone, selectedMember.fullName)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Enviar Mensagem (Saudades)
                      </button>
                    </div>
                  )}

                  {/* Behaviour Table by Week */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                      Frequência Semanal no Período
                    </h4>
                    <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                          <tr>
                            <th className="px-4 py-3">Semana de Referência</th>
                            <th className="px-4 py-3">Status de Presença</th>
                            <th className="px-4 py-3 text-center">Check-ins Registrados</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400">
                          {memberInsights.weeklyBehavior.map((week, index) => (
                            <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{week.label}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  week.status === 'Presente' 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' 
                                    : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                }`}>
                                  {week.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                {week.presences}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Presence logs details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                      Registro de Check-ins Individuais
                    </h4>
                    <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                          <tr>
                            <th className="px-4 py-2.5">Data / Horário</th>
                            <th className="px-4 py-2.5">Dia da Semana</th>
                            <th className="px-4 py-2.5">Período</th>
                            <th className="px-4 py-2.5">Confiança</th>
                            <th className="px-4 py-2.5">Câmera</th>
                            <th className="px-4 py-2.5 font-medium">Igreja Regional</th>
                            <th className="px-4 py-2.5 text-center no-print">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-slate-800/40 text-slate-600 dark:text-slate-400">
                          {memberRecords.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                                Sem check-ins registrados neste período.
                              </td>
                            </tr>
                          ) : (
                            memberRecords.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                                <td className="px-4 py-2.5 font-mono">{new Date(r.horario).toLocaleString('pt-BR')}</td>
                                <td className="px-4 py-2.5 font-medium">{getDayOfWeek(r.horario)}</td>
                                <td className="px-4 py-2.5">{getPeriod(r.horario)}</td>
                                <td className="px-4 py-2.5 font-bold font-mono">
                                  {r.confianca ? `${Math.round(r.confianca * 100)}%` : '—'}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs">{r.camera || '—'}</td>
                                <td className="px-4 py-2.5 font-medium">{r.igrejaRegional || '—'}</td>
                                <td className="px-4 py-2.5 text-center no-print">
                                  <button
                                    onClick={() => handleDeletePresenceFromHistory(r.id)}
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1"
                                    title="Excluir registro"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Printable report footer signature */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-8 flex justify-between items-center text-xs text-slate-400">
                    <span>saasChurch Relatórios Automatizados</span>
                    <div className="flex flex-col text-right">
                      <span>Assinatura do Responsável Ministerial</span>
                      <span className="w-48 border-b border-slate-400/80 mt-4 block self-end"></span>
                    </div>
                  </div>

                </div>

              </div>
            ) : null
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 font-medium no-print">
              Pesquise e selecione um membro acima para carregar o seu relatório de histórico individual.
            </div>
          )}

        </div>
      )}


      {/* ─── TAB 3: GRAPHS & INSIGHTS ─── */}
      {activeTab === 'insights' && (
        <div className="space-y-6 no-print">
          
          {loadingInsights ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 font-medium">
              Carregando estatísticas e insights...
            </div>
          ) : generalInsights ? (
            <div className="space-y-6">
              
              {/* Key Indicators Grid */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Total de Detecções Facial no Período</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white mt-2 block">
                    {generalInsights.totalCheckins}
                  </span>
                  <span className="text-xs text-slate-400 block mt-1">Registros de check-ins faciais recebidos</span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Dia de Maior Frequência</span>
                  <span className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-2 block">
                    {generalInsights.highestDay}
                  </span>
                  <span className="text-xs text-slate-400 block mt-1">Dia com maior quantidade de registros acumulados</span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Membros Faltosos</span>
                  <span className="text-3xl font-black text-red-500 mt-2 block">
                    {generalInsights.absentMembers.length}
                  </span>
                  <span className="text-xs text-slate-400 block mt-1">Ausentes em mais de um culto/serviço</span>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid lg:grid-cols-2 gap-6">
                
                {/* Checkins by Day of Week Chart */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">Detecções por Dia da Semana</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={generalInsights.dayChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                        />
                        <Legend />
                        <Bar dataKey="Presenças" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Period distribution chart */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">Detecções por Período</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={generalInsights.periodChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                        />
                        <Legend />
                        <Bar dataKey="Presenças" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Absent Members List (Ausentes por mais de um culto) */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Membros Ausentes (Faltaram a mais de 1 Culto no Período)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Lista de membros que possuem menos registros de presença facial em relação à quantidade de cultos realizados.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                      <tr>
                        <th className="px-6 py-3">ROL</th>
                        <th className="px-6 py-3">Nome</th>
                        <th className="px-6 py-3">Cargo</th>
                        <th className="px-6 py-3 text-center">Ausências (Cultos Faltados)</th>
                        <th className="px-6 py-3 text-center">Última Vez que veio</th>
                        <th className="px-6 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400">
                      {generalInsights.absentMembers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-550">
                            Nenhum membro classificado como ausente no período.
                          </td>
                        </tr>
                      ) : (
                        generalInsights.absentMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                            <td className="px-6 py-3 font-bold font-mono text-blue-600 dark:text-blue-400">
                              {member.rol || '—'}
                            </td>
                            <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white uppercase">
                              {member.fullName}
                            </td>
                            <td className="px-6 py-3">
                              {member.ecclesiasticalTitle || 'Membro'}
                            </td>
                            <td className="px-6 py-3 text-center font-bold text-red-500 font-mono">
                              {member.absenceCount}
                            </td>
                            <td className="px-6 py-3 text-center font-medium">
                              {member.lastSeen}
                            </td>
                            <td className="px-6 py-3 text-center">
                              <button
                                onClick={() => sendWhatsAppMessage(member.phone, member.fullName)}
                                className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors border border-green-200 dark:border-green-800"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Enviar WhatsApp
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 font-medium">
              Sem dados suficientes no período para exibir gráficos e insights.
            </div>
          )}

        </div>
      )}


      {/* ─── TAB 4: GENERAL ATTENDANCE REPORT ─── */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          
          {/* Report Filters Card (Invisible when printing) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm no-print space-y-6">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Relatório Completo de Presença Facial
            </h3>
            
            <div className="flex flex-wrap gap-4 items-end">
              
              {/* Período de Datas */}
              <div className="space-y-2 flex-1 min-w-[180px]">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">De</label>
                <input
                  type="datetime-local"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 text-slate-700"
                />
              </div>

              <div className="space-y-2 flex-1 min-w-[180px]">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Até</label>
                <input
                  type="datetime-local"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 text-slate-700"
                />
              </div>

              {/* Regional Selector */}
              <div className="space-y-2 flex-1 min-w-[180px]">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Regional</label>
                <select
                  value={selectedRegionalId}
                  onChange={(e) => setSelectedRegionalId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 text-slate-700"
                >
                  <option value="all">Todas as Regionais</option>
                  {regionais.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-select Dropdown for Churches */}
              <div className="space-y-2 relative flex-1 min-w-[200px]">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Igrejas</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowChurchesDropdown(!showChurchesDropdown);
                    setShowTitlesDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 flex justify-between items-center"
                >
                  <span className="truncate">
                    {selectedChurchIds.length === 0
                      ? "Todas as Igrejas"
                      : selectedChurchIds.length === 1
                      ? `${churches.find(c => c.id === selectedChurchIds[0])?.name || '1 selecionada'}`
                      : `${selectedChurchIds.length} selecionadas`}
                  </span>
                  <span className="text-xs text-slate-400">▼</span>
                </button>
                
                {showChurchesDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowChurchesDropdown(false)} />
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-72 overflow-y-auto p-3 space-y-3">
                      <input
                        type="text"
                        placeholder="Pesquisar igreja..."
                        value={churchSearch}
                        onChange={(e) => setChurchSearch(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-md text-xs dark:text-slate-100 text-slate-700 focus:outline-none"
                      />
                      
                      <div className="flex justify-between items-center text-xs font-bold text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedChurchIds(filteredChurches.map(c => c.id))}
                          className="hover:underline"
                        >
                          Marcar todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedChurchIds([])}
                          className="hover:underline"
                        >
                          Desmarcar todos
                        </button>
                      </div>

                      <div className="space-y-2 max-h-44 overflow-y-auto">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={selectedChurchIds.length === 0}
                            onChange={() => setSelectedChurchIds([])}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          Todas as Igrejas
                        </label>
                        
                        {filteredChurches.map((c) => {
                          const isChecked = selectedChurchIds.includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedChurchIds(selectedChurchIds.filter(id => id !== c.id));
                                  } else {
                                    setSelectedChurchIds([...selectedChurchIds, c.id]);
                                  }
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              {c.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Multi-select Dropdown for Titles */}
              <div className="space-y-2 relative flex-1 min-w-[200px]">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Títulos</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowTitlesDropdown(!showTitlesDropdown);
                    setShowChurchesDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 flex justify-between items-center"
                >
                  <span className="truncate">
                    {selectedTitleIds.length === 0
                      ? "Todos os Títulos"
                      : selectedTitleIds.length === 1
                      ? `${titles.find(t => t.id === selectedTitleIds[0])?.name || '1 selecionado'}`
                      : `${selectedTitleIds.length} selecionados`}
                  </span>
                  <span className="text-xs text-slate-400">▼</span>
                </button>
                
                {showTitlesDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTitlesDropdown(false)} />
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-72 overflow-y-auto p-3 space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTitleIds(titles.map(t => t.id))}
                          className="hover:underline"
                        >
                          Marcar todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedTitleIds([])}
                          className="hover:underline"
                        >
                          Desmarcar todos
                        </button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={selectedTitleIds.length === 0}
                            onChange={() => setSelectedTitleIds([])}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          Todos os Títulos
                        </label>
                        
                        {titles.map((t) => {
                          const isChecked = selectedTitleIds.includes(t.id);
                          return (
                            <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedTitleIds(selectedTitleIds.filter(id => id !== t.id));
                                  } else {
                                    setSelectedTitleIds([...selectedTitleIds, t.id]);
                                  }
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              {t.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Status/Situação Selector */}
              <div className="space-y-2 flex-1 min-w-[150px]">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Situação</label>
                <select
                  value={selectedSituacao}
                  onChange={(e) => setSelectedSituacao(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 text-slate-700"
                >
                  <option value="Todos">Todos</option>
                  <option value="Constante">Constante</option>
                  <option value="Inconstante">Inconstante</option>
                  <option value="Ausente">Ausente</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generateReport}
                  disabled={generatingReport}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap h-[38px]"
                >
                  {generatingReport ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Gerar
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={reportMembers.length === 0}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap h-[38px] disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={exportReportToExcel}
                  disabled={reportMembers.length === 0}
                  className="bg-green-700 hover:bg-green-800 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap h-[38px] disabled:opacity-40"
                  title="Exportar Excel"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
              </div>

            </div>
          </div>

          {/* Printable Report Spreadsheet Card */}
          {reportMembers.length > 0 ? (
            <div className="printable-report bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-md space-y-6">
              
              {/* Spreadsheet Header */}
              <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wide">
                    saasChurch - Gestão Ministerial
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold uppercase">
                    Relatório Completo de Frequência Individual
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 font-mono">
                  <div>Gerado em: {new Date().toLocaleDateString('pt-BR')}</div>
                  <div>Período: {new Date(de).toLocaleDateString('pt-BR')} até {new Date(ate).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              {/* Spreadsheet Table grid style */}
              <div className="overflow-x-auto border border-slate-350 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-755 dark:text-slate-350 font-bold border-b border-slate-350 dark:border-slate-700 text-xs">
                    <tr>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 text-center w-10 no-print">
                        <input
                          type="checkbox"
                          checked={reportMembers.length > 0 && selectedReportMemberIds.length === reportMembers.length}
                          onChange={toggleSelectAllMembers}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer accent-blue-600"
                        />
                      </th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 text-center w-14">ROL</th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800">Nome</th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 w-28">Cargo</th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800">Igreja</th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 text-center w-28">Situação</th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 text-center w-20">Com/Total</th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 text-center w-16">Falta</th>
                      <th className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 text-center w-24">Data Últ.</th>
                      
                      {/* Month columns */}
                      {reportMonths.map((m) => (
                        <th key={m.label} className="px-3 py-3 border-r border-slate-350 dark:border-slate-800 text-center w-18 uppercase font-mono">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-855 text-slate-850 dark:text-slate-250">
                    {reportMembers.map((member) => {
                      const isSelected = selectedReportMemberIds.includes(member.id);
                      return (
                        <tr 
                          key={member.id} 
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-855/10 transition-colors ${
                            !isSelected ? 'opacity-40 no-print' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-center no-print">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectMember(member.id)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer accent-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-blue-600 dark:text-blue-400 font-mono text-xs">
                            {member.rol || '—'}
                          </td>
                        <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 font-semibold uppercase text-xs tracking-wide">
                          {member.fullName}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-xs">
                          {member.cargo}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-xs">
                          {member.igreja}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            member.situacao === 'Constante'
                              ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400'
                              : member.situacao === 'Inconstante'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                          }`}>
                            {member.situacao}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-xs">
                          {member.comparecimentoStr}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs text-red-500 font-bold">
                          {member.absences}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs">
                          {member.lastSeenDate}
                        </td>
                        
                        {/* Month checkmarks */}
                        {reportMonths.map((m) => {
                          const hasPresence = member.monthPresenceMap[m.label];
                          return (
                            <td 
                              key={m.label} 
                              className={`px-3 py-2.5 border-r border-slate-200 dark:border-slate-800 text-center font-bold font-mono text-xs ${
                                hasPresence 
                                  ? 'bg-green-50/50 text-green-600 dark:bg-green-950/10 dark:text-green-400' 
                                  : 'bg-red-50/50 text-red-500 dark:bg-red-950/10 dark:text-red-400'
                              }`}
                            >
                              {hasPresence ? '✓' : 'X'}
                            </td>
                          );
                        })}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {/* Report Signature footer */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-8 flex justify-between items-center text-xs text-slate-400">
                <span>saasChurch Relatórios de Frequência Individual</span>
                <div className="flex flex-col text-right">
                  <span>Assinatura do Responsável Ministerial</span>
                  <span className="w-48 border-b border-slate-400/80 mt-4 block self-end"></span>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 font-medium">
              {generatingReport ? "Carregando membros e calculando frequências..." : "Utilize os filtros acima e clique em 'Gerar' para carregar a planilha de frequência."}
            </div>
          )}

        </div>
      )}

      {/* ─── TAB 5: DEVICES MANAGEMENT ─── */}
      {activeTab === 'devices' && (
        <div className="space-y-6 no-print animate-fade-in">
          
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-lg">
                <Cpu className="w-5 h-5 text-blue-500" />
                Gerenciamento de Leitores Face ID
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cadastre e associe os leitores biométricos locais do ControlID às respectivas congregações.
              </p>
            </div>
            
            <button
              onClick={handleNewDevice}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              Adicionar Dispositivo
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">ID / Serial do Equipamento</th>
                    <th className="px-6 py-4">Igreja Vinculada</th>
                    <th className="px-6 py-4">Usuário do Disp.</th>
                    <th className="px-6 py-4">Data de Cadastro</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400">
                  {loadingDevices ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Carregando leitores...
                      </td>
                    </tr>
                  ) : devices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        Nenhum dispositivo Face ID cadastrado para esta igreja.
                      </td>
                    </tr>
                  ) : (
                    devices.map((dev) => (
                      <tr key={dev.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                          {dev.name}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {dev.serial}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {dev.church?.name || "—"}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {dev.username || <span className="text-slate-350 dark:text-slate-700">não definido</span>}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {new Date(dev.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-center flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleEditDevice(dev)}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold"
                          >
                            Editar
                          </button>
                          <span className="text-slate-300 dark:text-slate-750">|</span>
                          <button
                            onClick={() => handleDeleteDevice(dev.id)}
                            className="text-red-500 hover:text-red-650 hover:underline text-xs font-semibold"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Overlay for Create/Edit */}
          {showDeviceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transform scale-100 transition-all">
                
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    {editingDevice ? "Editar Dispositivo" : "Cadastrar Novo Dispositivo"}
                  </h4>
                  <button
                    onClick={() => setShowDeviceModal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold text-lg"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Body / Form */}
                <form onSubmit={handleSaveDevice}>
                  <div className="p-6 space-y-4">
                    
                    {/* ID/Serial do Equipamento */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        ID/Serial do Dispositivo <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 99 ou Serial do ControlID"
                        value={deviceSerial}
                        onChange={(e) => setDeviceSerial(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                      />
                      <p className="text-[10px] text-slate-400">
                        Deve coincidir exatamente com o ID enviado nas requisições webhook (campo `device_id`).
                      </p>
                    </div>

                    {/* Nome/Identificação */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Nome / Localização <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Entrada Principal, Templo Central"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                      />
                    </div>

                    {/* Igreja Vinculada */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Igreja Vinculada <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={deviceChurchId}
                        onChange={(e) => setDeviceChurchId(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 text-slate-700"
                      >
                        {churches.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Usuário do Equipamento (Opcional) */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Usuário do Disp. (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="admin"
                          value={deviceUsername}
                          onChange={(e) => setDeviceUsername(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                        />
                      </div>

                      {/* Senha do Equipamento (Opcional) */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Senha do Disp. (Opcional)
                        </label>
                        <input
                          type="password"
                          placeholder="••••••"
                          value={devicePassword}
                          onChange={(e) => setDevicePassword(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/20 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeviceModal(false)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                    >
                      Salvar
                    </button>
                  </div>
                </form>

              </div>
            </div>
          )}

        </div>
      )}

      {/* Standard System Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        message={pendingConfirm?.message || ''}
        confirmLabel="Excluir"
        variant="danger"
        loading={confirmLoading}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          try {
            setConfirmLoading(true);
            await pendingConfirm.onConfirm();
            setPendingConfirm(null);
          } catch (err: any) {
            alert(err.message || "Erro ao processar exclusão.");
          } finally {
            setConfirmLoading(false);
          }
        }}
        onCancel={() => (confirmLoading ? null : setPendingConfirm(null))}
      />

    </div>
  );
}