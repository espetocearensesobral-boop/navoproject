import React, { useState, useEffect } from"react";
import { showToast } from "../ui/Toast";
import { Professional } from"../../types";
import {
 fetchProfessionalsFromSupabase,
 saveProfessionalInSupabase,
 deleteProfessionalInSupabase,
} from"../../services/supabaseDataService";
import { AdminPageHeader } from"./shared/AdminPageHeader";
import { AdminFab } from"./shared/AdminFab";
import { AdminModalV2 } from"./shared/AdminModalV2";
import { Button } from"../ui/Button";
import { AdminLabel } from"../ui/AdminLabel";
import { handleEnterAsTab } from"../../utils/formUtils";
import {
 Users,
 Plus,
 ChevronDown,
 ChevronUp,
 Edit2,
 Trash2,
 Star,
 Sparkles,
 CheckCircle2,
 X,
 Save,
 Search,
 DollarSign,
 Power,
 Scissors,
 UserCheck,
 MessageCircle,
 Calendar,
 LayoutGrid,
 List,
} from"lucide-react";

// Preset avatar photos for quick professional selection
const PRESET_BARBER_AVATARS = [
 {
 name:"Carlos - Master Fade",
 role:"Master Barber",
 url:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=300",
 },
 {
 name:"Matheus - Groomer Visagista",
 role:"Visagista",
 url:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=75&w=300",
 },
 {
 name:"Lucas - Freestyle & Arte",
 role:"Especialista Freestyle",
 url:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=75&w=300",
 },
 {
 name:"Rafael - Barba & Toalha Quente",
 role:"Barbeiro Sênior",
 url:"https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=75&w=300",
 },
 {
 name:"Gabriel - Química & Platino",
 role:"Colorista Masculino",
 url:"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=75&w=300",
 },
 {
 name:"Bruno - Corte Clássico",
 role:"Barbeiro Tradicional",
 url:"https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&q=75&w=300",
 },
];

const SUGGESTED_SPECIALTIES = [
"Degradê / Fade",
"Skin Fade Navalhado",
"Barboterapia Imperial",
"Freestyle Hair Art",
"Visagismo Masculino",
"Nevou / Platino Global",
"Pigmentação de Barba",
"Corte Infantil Estilizado",
"Tratamento Anti-Queda",
"Alinhamento com Toalha Quente",
];

export const ProfessionalsManagement: React.FC = () => {
 const [barbers, setBarbers] = useState<Professional[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<
"all"|"active"|"inactive"
 >("all");
 const [expandedBarberId, setExpandedBarberId] = useState<string | null>(null);
 const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

 const [isModalOpen, setIsModalOpen] = useState(false);
 const [activeFormTab, setActiveFormTab] = useState<
"profile"|"specialties"|"commission"|"schedule"
 >("profile");
 const [editingBarber, setEditingBarber] = useState<Professional | null>(null);
 const [toastMsg, setToastMsg] = useState<string | null>(null);

 // Form State
 const [formData, setFormData] = useState<Partial<Professional>>({
 name:"",
 nickname:"",
 role:"Master Barber",
 commission_rate: 0.45,
 photo_url:
"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=250",
 specialties: ["Degradê / Fade","Barboterapia Imperial"],
 working_hours: {
 days: ["mon","tue","wed","thu","fri","sat"],
 start:"08:00",
 end:"19:00",
 lunch_break: { start:"12:00", end:"13:00"},
 },
 is_active: true,
 bio:"",
 phone:"",
 pix_key:"",
 });

 const [specialtiesText, setSpecialtiesText] = useState(
"Degradê / Fade, Barboterapia Imperial",
 );

 useEffect(() => {
 loadBarbers();
 }, []);

 const loadBarbers = async () => {
 setLoading(true);
 const data = await fetchProfessionalsFromSupabase();
 // Exclude prof_any for staff management view
 setBarbers(data.filter((b) => b.id !=="prof_any"));
 setLoading(false);
 };

 
 const handleOpenCreate = () => {
 setEditingBarber(null);
 setFormData({
 name:"",
 nickname:"",
 role:"Master Barber",
 commission_rate: 0.45,
 photo_url:
"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=250",
 specialties: ["Degradê / Fade","Barboterapia Imperial"],
 working_hours: {
 days: ["mon","tue","wed","thu","fri","sat"],
 start:"08:00",
 end:"19:00",
 lunch_break: { start:"12:00", end:"13:00"},
 },
 is_active: true,
 bio:"Especialista em cortes modernos e alinhamento de barba de alta precisão.",
 phone:"(11) 99887-6655",
 pix_key:"carlos.silva@pix.com",
 });
 setSpecialtiesText("Degradê / Fade, Barboterapia Imperial");
 setActiveFormTab("profile");
 setIsModalOpen(true);
 };

 const handleOpenEdit = (barber: Professional) => {
 setEditingBarber(barber);
 setFormData({ ...barber });
 setSpecialtiesText(barber.specialties ? barber.specialties.join(",") :"");
 setActiveFormTab("profile");
 setIsModalOpen(true);
 };

 const handleDelete = async (id: string) => {
 if (
 window.confirm("Tem certeza que deseja excluir este barbeiro da equipe?")
 ) {
 const updated = await deleteProfessionalInSupabase(id);
 setBarbers(updated.filter((b) => b.id !=="prof_any"));
 showToast("Profissional removido com sucesso!");
 }
 };

 const handleToggleStatus = async (barber: Professional) => {
 const updatedStatus = !(barber.is_active ?? true);
 const updatedBarber: Professional = {
 ...barber,
 is_active: updatedStatus,
 };

 const updatedList = await saveProfessionalInSupabase(updatedBarber, true);
 setBarbers(updatedList.filter((b) => b.id !=="prof_any"));
 showToast(
 updatedStatus
 ? `${barber.name} ativado na agenda!`
 : `${barber.name} pausado temporariamente.`,
 );
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name) {
 alert("Por favor, informe o nome do profissional.");
 return;
 }

 const specs = specialtiesText
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean);

 const itemToSave: Professional = {
 id: editingBarber?.id || `prof_${Date.now()}`,
 name: formData.name ||"",
 nickname: formData.nickname || formData.name ||"",
 role: formData.role ||"Barbeiro Sênior",
 rating: editingBarber?.rating || 5.0,
 reviews_count: editingBarber?.reviews_count || 12,
 photo_url:
 formData.photo_url ||
"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=250",
 specialties:
 specs.length > 0 ? specs : ["Degradê / Fade","Barba Imperial"],
 commission_rate: Number(formData.commission_rate || 0.45),
 working_hours: formData.working_hours || {
 days: ["mon","tue","wed","thu","fri","sat"],
 start:"08:00",
 end:"19:00",
 lunch_break: { start:"12:00", end:"13:00"},
 },
 is_active: formData.is_active ?? true,
 bio: formData.bio ||"",
 phone: formData.phone ||"",
 pix_key: formData.pix_key ||"",
 };

 const updatedList = await saveProfessionalInSupabase(
 itemToSave,
 Boolean(editingBarber),
 );
 setBarbers(updatedList.filter((b) => b.id !=="prof_any"));
 setIsModalOpen(false);
 showToast(
 editingBarber
 ?"Cadastro do profissional atualizado!"
 :"Novo profissional cadastrado!",
 );
 };

 const handleAddSpecialtyTag = (tag: string) => {
 const currentSpecs = specialtiesText
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean);
 if (!currentSpecs.includes(tag)) {
 currentSpecs.push(tag);
 setSpecialtiesText(currentSpecs.join(","));
 }
 };

 const toggleDay = (day: string) => {
 const currentDays = formData.working_hours?.days || [];
 const newDays = currentDays.includes(day)
 ? currentDays.filter((d) => d !== day)
 : [...currentDays, day];

 setFormData({
 ...formData,
 working_hours: {
 ...(formData.working_hours || { start:"08:00", end:"19:00"}),
 days: newDays,
 },
 });
 };

 const dayLabels: { [key: string]: string } = {
 mon:"Seg",
 tue:"Ter",
 wed:"Qua",
 thu:"Qui",
 fri:"Sex",
 sat:"Sáb",
 sun:"Dom",
 };

 // Filtered list
 const filteredBarbers = barbers.filter((b) => {
 const matchesSearch =
 b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (b.nickname &&
 b.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
 b.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (b.specialties &&
 b.specialties.some((s) =>
 s.toLowerCase().includes(searchQuery.toLowerCase()),
 ));

 let matchesStatus = true;
 if (statusFilter ==="active") matchesStatus = b.is_active ?? true;
 if (statusFilter ==="inactive")
 matchesStatus = (b.is_active ?? true) === false;

 return matchesSearch && matchesStatus;
 });

 // Stats calculation
 const totalBarbers = barbers.length;
 const activeBarbers = barbers.filter((b) => b.is_active ?? true).length;
 const avgRating =
 totalBarbers > 0
 ? (
 barbers.reduce((acc, b) => acc + (b.rating || 5.0), 0) / totalBarbers
 ).toFixed(1)
 :"5.0";
 const avgCommission =
 totalBarbers > 0
 ? Math.round(
 (barbers.reduce((acc, b) => acc + (b.commission_rate || 0.45), 0) /
 totalBarbers) *
 100,
 )
 : 45;

 return (
 <div className="space-y-4 animate-in fade-in duration-300">
 {/* Header (desktop) */}
 <AdminPageHeader
 icon={Users}
 title="Equipe"
 stats={[{ label:"ativos", value: activeBarbers, tone:"gold"}]}
 />

 {/* TOAST MESSAGE */}
 {toastMsg && (
 <div className="bg-status-success/10 border border-status-success/30 text-status-success p-3 rounded-[var(--admin-radius-lg)] flex items-center gap-2 text-xs font-bold animate-fade-in">
 <CheckCircle2 className="w-4 h-4 shrink-0"/>
 <span>{toastMsg}</span>
 </div>
 )}

 {/* COMPACT KPI CARDS */}
 <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-2.5">
 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
 <span className="text-xs font-bold uppercase tracking-wider">
 Total Equipe
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center">
 <Users className="w-3.5 h-3.5"/>
 </div>
 </div>
 <p className="text-lg font-mono num-tabular text-[var(--admin-text-main)] font-semibold">
 {totalBarbers}
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
 Profissionais cadastrados
 </p>
 </div>

 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
 <span className="text-xs font-bold uppercase tracking-wider">
 Ativos na Agenda
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-status-success/10 text-status-success flex items-center justify-center">
 <UserCheck className="w-3.5 h-3.5"/>
 </div>
 </div>
 <p className="text-lg font-mono num-tabular font-bold text-status-success">
 {activeBarbers}
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
 Cadeiras disponíveis
 </p>
 </div>

 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
 <span className="text-xs font-bold uppercase tracking-wider">
 Média Avaliação
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-status-warning/10 text-status-warning flex items-center justify-center">
 <Star className="w-3.5 h-3.5 fill-amber-400"/>
 </div>
 </div>
 <p className="text-lg font-mono num-tabular font-bold text-status-warning">
 {avgRating} / 5
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
 Sua equipe em destaque
 </p>
 </div>

 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
 <span className="text-xs font-bold uppercase tracking-wider">
 Comissão Média
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-status-info/10 text-status-info flex items-center justify-center">
 <DollarSign className="w-3.5 h-3.5"/>
 </div>
 </div>
 <p className="text-lg font-mono num-tabular text-[var(--admin-text-main)] font-semibold">
 {avgCommission}%
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
 Por serviço prestado
 </p>
 </div>
 </div>

 {/* MOBILE: SEARCH AND FILTERS */}
 <div className="md:hidden space-y-2 mb-3">
 <div className="bg-[var(--admin-surface)] p-3 rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)]">
 <div className="relative">
 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]"/>
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Buscar profissional..."
 className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] pl-10 pr-3 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
 />
 </div>
 </div>
 <div
 data-gesture-scroll="horizontal"
 className="admin-category-scroll flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
 >
 <button
 type="button"
 onClick={() => setStatusFilter("all")}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-full)] text-sm font-semibold whitespace-nowrap transition-colors ${statusFilter ==="all"?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)]":"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
 >
 Todos ({totalBarbers})
 </button>
 <button
 type="button"
 onClick={() => setStatusFilter("active")}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-full)] text-sm font-semibold whitespace-nowrap transition-colors ${statusFilter ==="active"?"bg-status-success text-white":"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
 >
 Ativos ({activeBarbers})
 </button>
 <button
 type="button"
 onClick={() => setStatusFilter("inactive")}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-full)] text-sm font-semibold whitespace-nowrap transition-colors ${statusFilter ==="inactive"?"bg-red-500 text-white":"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
 >
 Pausados ({totalBarbers - activeBarbers})
 </button>
 </div>
 </div>

 {/* DESKTOP SEARCH AND FILTERS */}
 <div className="hidden md:flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-[var(--admin-surface)] p-2.5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)]">
 <div className="relative flex-1">
 <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]"/>
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Buscar por nome, apelido, cargo ou especialidade..."
 className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] pl-8 pr-3 py-1.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
 />
 </div>

 <div className="flex items-center gap-2 justify-between sm:justify-end min-w-0">
 <div
 data-gesture-scroll="horizontal"
 className="admin-category-scroll flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0"
 >
 <button
 onClick={() => setStatusFilter("all")}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-lg)] text-sm font-semibold whitespace-nowrap transition-colors ${
 statusFilter ==="all"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
 :"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
 }`}
 >
 Todos ({totalBarbers})
 </button>
 <button
 onClick={() => setStatusFilter("active")}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-lg)] text-sm font-semibold whitespace-nowrap transition-colors ${
 statusFilter ==="active"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
 :"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
 }`}
 >
 Ativos ({activeBarbers})
 </button>
 <button
 onClick={() => setStatusFilter("inactive")}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-lg)] text-sm font-semibold whitespace-nowrap transition-colors ${
 statusFilter ==="inactive"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
 :"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
 }`}
 >
 Pausados ({totalBarbers - activeBarbers})
 </button>
 </div>

 <div className="hidden md:flex items-center gap-1 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 rounded-[var(--admin-radius-lg)]">
 <button
 type="button"
 onClick={() => setViewMode("grid")}
 className={`p-1.5 rounded-[var(--admin-radius-md)] transition-colors ${viewMode === "grid" ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]" : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"}`}
 title="Visualização em Grade (Cards)"
 aria-label="Visualização em Grade"
 >
 <LayoutGrid className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => setViewMode("table")}
 className={`p-1.5 rounded-[var(--admin-radius-md)] transition-colors ${viewMode === "table" ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]" : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"}`}
 title="Visualização em Tabela"
 aria-label="Visualização em Tabela"
 >
 <List className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>

 {/* CARDS / BENTO GRID VIEW */}
 <div className="admin-table-container">
 {/* DESKTOP BENTO GRID / TABLE VIEW */}
 <div className="hidden md:block">
 {viewMode === "grid" ? (
 <div>
 {loading ? (
 <div className="p-12 text-center text-[var(--admin-text-muted)] bg-[var(--admin-surface)] rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)]">
 <Scissors className="w-6 h-6 text-[var(--admin-accent)] animate-spin mx-auto mb-2" />
 Carregando profissionais...
 </div>
 ) : filteredBarbers.length === 0 ? (
 <div className="p-12 text-center text-[var(--admin-text-muted)] bg-[var(--admin-surface)] rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)]">
 Nenhum profissional encontrado.
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
 {filteredBarbers.map((barber) => {
 const isActive = barber.is_active ?? true;
 const commissionPercent = Math.round((barber.commission_rate || 0.45) * 100);

 return (
 <article
 key={barber.id}
 className={`bg-[var(--admin-surface)] border rounded-[var(--admin-radius-xl)] p-4 flex flex-col justify-between transition-all hover:shadow-md ${
 !isActive ? "border-[var(--admin-border)] opacity-75" : "border-[var(--admin-border)] hover:border-[var(--admin-accent)]/50"
 }`}
 >
 <div>
 {/* Header: Avatar + Name + Status Badge */}
 <div className="flex items-start gap-3 mb-3">
 <div className="relative w-12 h-12 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] overflow-hidden shrink-0 bg-[var(--admin-bg)]">
 <img src={barber.photo_url} alt={barber.name} className="w-full h-full object-cover" />
 <span
 className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--admin-surface)] ${
 isActive ? "bg-status-success" : "bg-status-error"
 }`}
 />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center justify-between gap-1">
 <h3 className="font-bold text-sm text-[var(--admin-text-main)] truncate">
 {barber.name}
 </h3>
 <span
 className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
 isActive
 ? "bg-status-success/15 text-status-success"
 : "bg-status-error/15 text-status-error"
 }`}
 >
 {isActive ? "Ativo" : "Pausado"}
 </span>
 </div>
 {barber.nickname && (
 <p className="text-xs text-[var(--admin-text-muted)] truncate">"{barber.nickname}"</p>
 )}
 <div className="mt-1 flex items-center gap-1.5">
 <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[var(--admin-bg)] text-[var(--admin-accent)] border border-[var(--admin-border)] uppercase tracking-wider">
 {barber.role}
 </span>
 </div>
 </div>
 </div>

 {/* Info Row: Rating, Hours, Commission */}
 <div className="grid grid-cols-3 gap-2 p-2.5 bg-[var(--admin-bg)]/60 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)]/60 text-xs mb-3">
 <div>
 <span className="text-[10px] text-[var(--admin-text-muted)] uppercase font-semibold block">Avaliação</span>
 <div className="flex items-center gap-1 text-amber-500 font-bold mt-0.5">
 <Star className="w-3 h-3 fill-amber-500" />
 {(barber.rating || 5.0).toFixed(1)}
 </div>
 </div>
 <div>
 <span className="text-[10px] text-[var(--admin-text-muted)] uppercase font-semibold block">Comissão</span>
 <span className="font-mono font-bold text-[var(--admin-text-main)] mt-0.5 block">
 {commissionPercent}%
 </span>
 </div>
 <div>
 <span className="text-[10px] text-[var(--admin-text-muted)] uppercase font-semibold block">Turno</span>
 <span className="text-[11px] font-bold text-[var(--admin-text-main)] mt-0.5 block truncate">
 {barber.working_hours?.start || "08:00"}–{barber.working_hours?.end || "19:00"}
 </span>
 </div>
 </div>
 </div>

 {/* Actions Footer */}
 <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--admin-border)]/60">
 <div className="flex items-center gap-1.5">
 {barber.phone && (
 <a
 href={`https://wa.me/55${barber.phone.replace(/\D/g, "")}`}
 target="_blank"
 rel="noreferrer"
 className="p-2 rounded-[var(--admin-radius-sm)] text-[var(--admin-text-muted)] hover:text-status-success hover:bg-status-success/10 transition-colors"
 title="WhatsApp"
 >
 <MessageCircle className="w-4 h-4" />
 </a>
 )}
 <button
 type="button"
 onClick={() => handleToggleStatus(barber)}
 className={`p-2 rounded-[var(--admin-radius-sm)] transition-colors ${
 isActive
 ? "text-status-success hover:bg-status-success/10"
 : "text-status-error hover:bg-status-error/10"
 }`}
 title={isActive ? "Pausar" : "Ativar"}
 >
 <Power className="w-4 h-4" />
 </button>
 </div>

 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => handleOpenEdit(barber)}
 className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--admin-radius-sm)] text-xs font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)] transition-colors"
 >
 <Edit2 className="w-3.5 h-3.5" />
 Editar
 </button>
 <button
 type="button"
 onClick={() => handleDelete(barber.id)}
 className="p-1.5 rounded-[var(--admin-radius-sm)] text-[var(--admin-text-muted)] hover:text-status-error hover:bg-status-error/10 transition-colors"
 title="Excluir"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 </article>
 );
 })}
 </div>
 )}
 </div>
 ) : (
 <table className="admin-table">
 <thead>
 <tr>
 <th className="w-12">Foto</th>
 <th>Profissional</th>
 <th>Cargo</th>
 <th>Avaliação</th>
 <th>Comissão</th>
 <th>Turno</th>
 <th className="text-right">Ações</th>
 </tr>
 </thead>
 <tbody>
 {loading ? (
 <tr>
 <td colSpan={7} className="py-12 text-center text-[var(--admin-text-muted)]">
 Carregando equipe...
 </td>
 </tr>
 ) : filteredBarbers.length === 0 ? (
 <tr>
 <td colSpan={7} className="py-12 text-center text-[var(--admin-text-muted)]">
 Nenhum profissional encontrado.
 </td>
 </tr>
 ) : (
 filteredBarbers.map((barber) => {
 const isActive = barber.is_active ?? true;
 const commissionPercent = Math.round((barber.commission_rate || 0.45) * 100);

 return (
 <tr key={barber.id} className={!isActive ?"opacity-75":""}>
 <td>
 <div className="w-10 h-10 rounded border border-[var(--admin-border)] overflow-hidden relative">
 <img src={barber.photo_url} alt={barber.name} className="w-full h-full object-cover"/>
 <span
 className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-[var(--admin-radius-full)] border border-white ${
 isActive ?"bg-status-success":"bg-red-500"
 }`}
 />
 </div>
 </td>
 <td>
 <div className="font-bold text-[var(--admin-text-main)] admin-clamp-1">{barber.name}</div>
 {barber.nickname && (
 <div className="text-xs text-[var(--admin-text-muted)] admin-clamp-1">
"{barber.nickname}"
 </div>
 )}
 </td>
 <td>
 <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[var(--admin-surface)] text-[var(--admin-accent)] border border-[var(--admin-border)] uppercase tracking-wider">
 {barber.role}
 </span>
 </td>
 <td>
 <div className="flex items-center gap-1 font-bold text-amber-500">
 <Star className="w-3.5 h-3.5 fill-amber-500"/>
 {(barber.rating || 5.0).toFixed(1)}
 <span className="text-xs text-[var(--admin-text-muted)] font-normal ml-0.5">
 ({barber.reviews_count || 10})
 </span>
 </div>
 </td>
 <td>
 <div className="font-mono font-bold text-[var(--admin-text-main)]">
 {commissionPercent}%
 </div>
 </td>
 <td className="text-[var(--admin-text-muted)]">
 <div className="text-xs font-bold text-[var(--admin-text-main)]">
 {barber.working_hours?.start ||"08:00"}–{barber.working_hours?.end ||"19:00"}
 </div>
 <div className="text-[10px] uppercase tracking-wider mt-0.5">
 {barber.working_hours?.days?.map((day) => dayLabels[day] || day).join(",") ||"Seg-Sáb"}
 </div>
 </td>
 <td>
 <div className="flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={() => handleToggleStatus(barber)}
 className={`admin-btn-icon-sm rounded ${isActive ?"text-status-success hover:bg-status-success/10":"text-status-error hover:bg-status-error/10"}`}
 title={isActive ?"Pausar":"Ativar"}
 >
 <Power className="w-4 h-4"/>
 </button>
 {barber.phone && (
 <a
 href={`https://wa.me/55${barber.phone.replace(/\D/g,"")}`}
 target="_blank"
 rel="noreferrer"
 className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-status-success hover:bg-status-success/10"
 title="WhatsApp"
 >
 <MessageCircle className="w-4 h-4"/>
 </a>
 )}
 <button
 type="button"
 onClick={() => handleOpenEdit(barber)}
 className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)]"
 title="Editar"
 >
 <Edit2 className="w-4 h-4"/>
 </button>
 <button
 type="button"
 onClick={() => handleDelete(barber.id)}
 className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-status-error hover:bg-status-error/10"
 title="Excluir"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 )}
 </div>

 {/* MOBILE LIST VIEW */}
 <div className="md:hidden divide-y divide-[var(--admin-border)]">
 {loading ? (
 <div className="p-8 text-center bg-[var(--admin-surface)] text-sm text-[var(--admin-text-muted)]">
 <Scissors className="w-5 h-5 text-[var(--admin-accent)] animate-spin mx-auto mb-2"/>
 Carregando equipe...
 </div>
 ) : filteredBarbers.length === 0 ? (
 <div className="p-8 text-center bg-[var(--admin-surface)] text-sm text-[var(--admin-text-muted)]">
 Nenhum profissional encontrado.
 </div>
 ) : (
 filteredBarbers.map((barber) => {
 const isActive = barber.is_active ?? true;
 const isExpanded = expandedBarberId === barber.id;
 const commissionPercent = Math.round((barber.commission_rate || 0.45) * 100);

 return (
 <article key={barber.id} className="bg-[var(--admin-surface)] overflow-hidden transition-colors">
 <button
 type="button"
 onClick={() => setExpandedBarberId(isExpanded ? null : barber.id)}
 aria-expanded={isExpanded}
 className="w-full min-h-[76px] p-3.5 text-left flex items-center gap-3 hover:bg-[var(--admin-bg)]/40"
 >
 <div className="w-11 h-11 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)] overflow-hidden flex items-center justify-center shrink-0 relative">
 <img src={barber.photo_url} alt=""className="w-full h-full object-cover"/>
 <span
 className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-[var(--admin-radius-full)] border border-[var(--admin-surface)] ${
 isActive ?"bg-status-success":"bg-red-500"
 }`}
 />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 min-w-0">
 <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border border-[var(--admin-accent)]/20">
 {barber.role}
 </span>
 </div>
 <h2 className="mt-0.5 text-sm font-bold text-[var(--admin-text-main)] admin-clamp-1">
 {barber.name}
 </h2>
 <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mt-0.5">
 <Star className="w-3 h-3 fill-amber-500"/> {(barber.rating || 5.0).toFixed(1)}
 <span className="text-[var(--admin-text-muted)] font-normal ml-0.5">({barber.reviews_count || 10})</span>
 </div>
 </div>
 <div className="text-right shrink-0 min-w-[58px]">
 <p className="text-xs font-bold text-[var(--admin-text-main)] font-mono">
 {commissionPercent}%
 </p>
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">
 {barber.working_hours?.start ||"08:00"}–{barber.working_hours?.end ||"19:00"}
 </p>
 </div>
 {isExpanded ? (
 <ChevronUp className="w-4 h-4 text-[var(--admin-accent)] shrink-0 ml-1"/>
 ) : (
 <ChevronDown className="w-4 h-4 text-[var(--admin-text-muted)] shrink-0 ml-1"/>
 )}
 </button>
 {isExpanded && (
 <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)]/35 p-3.5 space-y-3">
 {barber.bio && (
 <p className="text-xs text-[var(--admin-text-muted)] mb-2">{barber.bio}</p>
 )}
 
 <div className="grid grid-cols-2 gap-2 mb-3">
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-md)] p-2">
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] font-bold">Contato</p>
 <p className="text-xs font-bold text-[var(--admin-text-main)] mt-0.5 admin-clamp-1">{barber.phone ||"Não inf."}</p>
 </div>
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-md)] p-2">
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] font-bold">Chave PIX</p>
 <p className="text-xs font-bold text-[var(--admin-text-main)] mt-0.5 admin-clamp-1">{barber.pix_key ||"Não inf."}</p>
 </div>
 </div>

 <div className="flex gap-2 border-t border-[var(--admin-border)] pt-2">
 <button
 type="button"
 onClick={() => handleToggleStatus(barber)}
 className={`flex-1 min-h-10 rounded-[var(--admin-radius-md)] border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
 isActive
 ?"bg-status-error/10 text-red-500 border-status-error/30"
 :"bg-status-success/10 text-status-success border-status-success/20"
 }`}
 >
 <Power className="w-3.5 h-3.5"/> {isActive ?"Pausar":"Ativar"}
 </button>
 {barber.phone && (
 <a
 href={`https://wa.me/55${barber.phone.replace(/\D/g,"")}`}
 target="_blank"
 rel="noreferrer"
 className="flex-1 min-h-10 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] bg-[var(--admin-surface)] hover:bg-[var(--admin-bg)] text-[var(--admin-text-main)] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
 >
 <MessageCircle className="w-3.5 h-3.5"/> WhatsApp
 </a>
 )}
 </div>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => handleOpenEdit(barber)}
 className="flex-1 min-h-10 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)] text-xs font-bold flex items-center justify-center gap-1.5"
 >
 <Edit2 className="w-4 h-4"/> Editar
 </button>
 <button
 type="button"
 onClick={() => handleDelete(barber.id)}
 className="w-10 h-10 shrink-0 rounded-[var(--admin-radius-md)] border border-status-error/25 text-status-error hover:bg-status-error/10 flex items-center justify-center"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </div>
 )}
 </article>
 );
 })
 )}
 </div>
 </div>

 {/* CREATE/EDIT MODAL FULLSCREEN */}
 {isModalOpen && (
 <AdminModalV2
 icon={Users}
 eyebrow="Equipe & Profissionais"
 title={editingBarber ? `Editar Barbeiro: ${editingBarber.name}` :"Novo Barbeiro"}
 subtitle="Configuração de perfil, comissões, especialidades e horários de atendimento."
 onClose={() => setIsModalOpen(false)}
 size="fullscreen"
 footer={
 <div className="flex items-center justify-between w-full">
 <Button
 type="button"
 variant="ghost"
 size="md"
 onClick={() => setIsModalOpen(false)}
 >
 Cancelar
 </Button>

 <div className="flex items-center gap-3">
 <Button
 type="submit"
 form="professionalForm"
 variant="primary"
 size="md"
 className="px-6 font-bold"
 >
 <Save className="w-4 h-4"/>
 <span>Salvar Barbeiro</span>
 </Button>
 </div>
 </div>
 }
 >
 <div className="space-y-6">
 {/* Modal Tabs Header */}
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-2 flex flex-wrap sm:flex-nowrap gap-2 shadow-xs">
 <button
 type="button"
 onClick={() => setActiveFormTab("profile")}
 className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-[var(--admin-radius-lg)] text-xs sm:text-sm font-bold transition-all ${
 activeFormTab ==="profile"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-xs"
 :"text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)]"
 }`}
 >
 <UserCheck className="w-4 h-4 shrink-0"/>
 <span>1. Perfil & Dados</span>
 </button>

 <button
 type="button"
 onClick={() => setActiveFormTab("specialties")}
 className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-[var(--admin-radius-lg)] text-xs sm:text-sm font-bold transition-all ${
 activeFormTab ==="specialties"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-xs"
 :"text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)]"
 }`}
 >
 <Scissors className="w-4 h-4 shrink-0"/>
 <span>2. Especialidades</span>
 </button>

 <button
 type="button"
 onClick={() => setActiveFormTab("commission")}
 className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-[var(--admin-radius-lg)] text-xs sm:text-sm font-bold transition-all ${
 activeFormTab ==="commission"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-xs"
 :"text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)]"
 }`}
 >
 <DollarSign className="w-4 h-4 shrink-0"/>
 <span>3. Comissão & PIX</span>
 </button>

 <button
 type="button"
 onClick={() => setActiveFormTab("schedule")}
 className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-[var(--admin-radius-lg)] text-xs sm:text-sm font-bold transition-all ${
 activeFormTab ==="schedule"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-xs"
 :"text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)]"
 }`}
 >
 <Calendar className="w-4 h-4 shrink-0"/>
 <span>4. Horários & Agenda</span>
 </button>
 </div>

 {/* Modal Form */}
 <form
 id="professionalForm"
 onKeyDown={handleEnterAsTab}
 onSubmit={handleSubmit}
 className="space-y-6"
 >
 {/* TAB 1: PROFILE */}
 {activeFormTab ==="profile"&& (
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-6 sm:p-8 space-y-6 shadow-xs">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Nome Completo *
 </span>
 <input
 type="text"
 required
 value={formData.name}
 onChange={(e) =>
 setFormData({ ...formData, name: e.target.value })
 }
 placeholder="Ex: Carlos Eduardo Silva"
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors font-medium"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Apelido / Identificação da Cadeira
 </span>
 <input
 type="text"
 value={formData.nickname}
 onChange={(e) =>
 setFormData({ ...formData, nickname: e.target.value })
 }
 placeholder="Ex: Carlão Fade (Cadeira 01)"
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Cargo / Título Profissional
 </span>
 <input
 type="text"
 value={formData.role}
 onChange={(e) =>
 setFormData({ ...formData, role: e.target.value })
 }
 placeholder="Ex: Master Barber & Visagista"
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 WhatsApp / Telefone de Contato
 </span>
 <input
 type="text"
 value={formData.phone ||""}
 onChange={(e) =>
 setFormData({ ...formData, phone: e.target.value })
 }
 placeholder="(11) 99887-6655"
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Biografia / Apresentação para Clientes
 </span>
 <textarea
 rows={3}
 value={formData.bio ||""}
 onChange={(e) =>
 setFormData({ ...formData, bio: e.target.value })
 }
 placeholder="Mais de 8 anos de experiência em cortes clássicos e modernos, barba terapia e visagismo masculino..."
 className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] resize-none transition-colors"
 />
 </label>
 </div>

 {/* Photo selection */}
 <div className="p-5 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-4">
 <p className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider">
 Foto de Perfil do Profissional
 </p>

 <div className="flex flex-col sm:flex-row items-center gap-4">
 <img
 src={formData.photo_url}
 alt="Preview do Barbeiro"
 className="w-16 h-16 rounded-[var(--admin-radius-xl)] object-cover border-2 border-[var(--admin-accent)] shrink-0 shadow-xs"
 />
 <input
 type="url"
 value={formData.photo_url ||""}
 onChange={(e) =>
 setFormData({
 ...formData,
 photo_url: e.target.value,
 })
 }
 placeholder="Cole a URL da imagem de perfil..."
 className="w-full h-11 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </div>

 <div>
 <p className="text-xs text-[var(--admin-text-muted)] font-bold uppercase mb-2">
 Ou escolha um avatar predefinido:
 </p>
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
 {PRESET_BARBER_AVATARS.map((preset, idx) => (
 <button
 key={idx}
 type="button"
 onClick={() =>
 setFormData({ ...formData, photo_url: preset.url })
 }
 className={`group relative rounded-[var(--admin-radius-lg)] overflow-hidden border-2 transition-all h-20 ${
 formData.photo_url === preset.url
 ?"border-[var(--admin-accent)] ring-2 ring-[var(--admin-accent)]"
 :"border-[var(--admin-border)] opacity-70 hover:opacity-100 hover:border-[var(--admin-accent)]/50"
 }`}
 >
 <img
 src={preset.url}
 alt={preset.name}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform"
 />
 <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-center">
 <span className="text-[10px] font-bold text-white block truncate">
 {preset.name}
 </span>
 </div>
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* TAB 2: SPECIALTIES */}
 {activeFormTab ==="specialties"&& (
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-6 sm:p-8 space-y-6 shadow-xs">
 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Especialidades Principais (separadas por vírgula)
 </span>
 <input
 type="text"
 value={specialtiesText}
 onChange={(e) => setSpecialtiesText(e.target.value)}
 placeholder="Ex: Degradê Navalhado, Barboterapia Imperial, Cortes Clássicos, Visagismo"
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors font-medium"
 />
 </label>
 </div>

 <div className="p-5 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
 <p className="text-xs font-bold text-[var(--admin-accent)] flex items-center gap-1.5 uppercase">
 <Sparkles className="w-4 h-4"/>
 <span>Clique para adicionar especialidades sugeridas:</span>
 </p>
 <div className="flex flex-wrap gap-2 pt-1">
 {SUGGESTED_SPECIALTIES.map((tag) => (
 <button
 key={tag}
 type="button"
 onClick={() => handleAddSpecialtyTag(tag)}
 className="px-3.5 py-2 rounded-[var(--admin-radius-lg)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:border-[var(--admin-accent)] border border-[var(--admin-border)] text-xs font-bold transition-colors"
 >
 + {tag}
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* TAB 3: COMMISSION & PIX */}
 {activeFormTab ==="commission"&& (
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-6 sm:p-8 space-y-6 shadow-xs">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider finance-positive mb-2">
 Taxa de Comissão do Profissional (Ex: 0.45 = 45%) *
 </span>
 <div className="relative">
 <input
 type="number"
 step="0.01"
 min="0"
 max="1"
 required
 value={formData.commission_rate}
 onChange={(e) =>
 setFormData({
 ...formData,
 commission_rate: Number(e.target.value),
 })
 }
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-base font-bold finance-positive focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold finance-positive">
 {Math.round((formData.commission_rate || 0) * 100)}%
 </span>
 </div>
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Chave PIX para Repasses Semanais / Mensais
 </span>
 <input
 type="text"
 value={formData.pix_key ||""}
 onChange={(e) =>
 setFormData({ ...formData, pix_key: e.target.value })
 }
 placeholder="CPF, e-mail, telefone ou chave aleatória"
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors font-mono"
 />
 </label>
 </div>
 </div>

 <div className="p-5 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-2">
 <p className="text-xs text-[var(--admin-accent)] font-bold uppercase tracking-wider">
 Simulador de Repasse Financeiro Automático
 </p>
 <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] border border-[var(--admin-border)] gap-3">
 <div>
 <span className="text-xs text-[var(--admin-text-muted)] block">Para cada R$ 100,00 faturados na comanda:</span>
 <span className="text-base font-bold text-[var(--admin-text-main)]">
 Barbearia fica com R$ {(100 - (formData.commission_rate || 0.45) * 100).toFixed(2)}
 </span>
 </div>
 <div className="text-right">
 <span className="text-xs text-[var(--admin-text-muted)] block">Repasse do Barbeiro:</span>
 <span className="text-lg font-black text-status-success">
 R$ {((formData.commission_rate || 0.45) * 100).toFixed(2)}
 </span>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* TAB 4: SCHEDULE */}
 {activeFormTab ==="schedule"&& (
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-6 sm:p-8 space-y-6 shadow-xs">
 <div className="p-4 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] flex items-center justify-between">
 <div>
 <span className="text-sm font-bold text-[var(--admin-text-main)] block">
 Disponibilidade de Agendamento Online
 </span>
 <span className="text-xs text-[var(--admin-text-muted)]">
 Habilita a exibição do profissional na lista de seleção dos clientes
 </span>
 </div>
 <button
 type="button"
 onClick={() =>
 setFormData({
 ...formData,
 is_active: !(formData.is_active ?? true),
 })
 }
 className={`px-4 py-2 rounded-[var(--admin-radius-lg)] text-xs font-bold transition-colors ${
 (formData.is_active ?? true)
 ?"bg-status-success text-white shadow-xs"
 :"bg-status-error/10 text-status-error border border-status-error/30"
 }`}
 >
 {(formData.is_active ?? true) ?"● Ativo na Agenda":"○ Pausado"}
 </button>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Horário de Início do Expediente
 </span>
 <input
 type="time"
 value={formData.working_hours?.start ||"08:00"}
 onChange={(e) =>
 setFormData({
 ...formData,
 working_hours: {
 ...(formData.working_hours || {
 days: [
"mon",
"tue",
"wed",
"thu",
"fri",
"sat",
 ],
 end:"19:00",
 }),
 start: e.target.value,
 },
 })
 }
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm font-bold text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Horário de Fim do Expediente
 </span>
 <input
 type="time"
 value={formData.working_hours?.end ||"19:00"}
 onChange={(e) =>
 setFormData({
 ...formData,
 working_hours: {
 ...(formData.working_hours || {
 days: [
"mon",
"tue",
"wed",
"thu",
"fri",
"sat",
 ],
 start:"08:00",
 }),
 end: e.target.value,
 },
 })
 }
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] px-4 text-sm font-bold text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>
 </div>

 <div>
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Dias da Semana Trabalhados
 </span>
 <div className="flex flex-wrap gap-2">
 {Object.keys(dayLabels).map((day) => {
 const isActive =
 formData.working_hours?.days.includes(day);
 return (
 <button
 key={day}
 type="button"
 onClick={() => toggleDay(day)}
 className={`px-4 py-2.5 rounded-[var(--admin-radius-lg)] text-xs font-bold transition-all ${
 isActive
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-xs"
 :"bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] hover:text-[var(--admin-text-main)]"
 }`}
 >
 {dayLabels[day]}
 </button>
 );
 })}
 </div>
 </div>
 </div>
 )}
 </form>
 </div>
 </AdminModalV2>
 )}

 <AdminFab
 onClick={handleOpenCreate}
 label="Novo Barbeiro"
 icon={Plus}
 />
 </div>
 );
};
