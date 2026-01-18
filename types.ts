
export enum TaskStatus {
  PENDING = 'Pendente',
  IN_PROGRESS = 'Em Progresso',
  DONE = 'Concluído',
}

export enum Priority {
  HIGH = 'Alta',
  MEDIUM = 'Média',
  LOW = 'Baixa',
}

export interface Task {
  id: string;
  title: string;
  description?: string; // New: Detailed description

  // Patient Context
  isPatientRelated?: boolean; // New: Toggle
  patient?: string;
  patientCard?: string; // New: Carteirinha
  patientGuide?: string; // New: Guia
  patientPhone?: string; // New: Telefone

  status: TaskStatus;
  priority: Priority;
  date: string;
  assignedTo?: string;

  // New Fields for "Recado" functionality in Tasks Tab
  taskType?: 'task' | 'message';
  messageType?: 'Receita' | 'Medicamentos' | 'Outros';
  authorName?: string;
  createdAt?: string;
  recipientId?: string; // ID of the professional (doctor)
  recipientName?: string; // Name of the professional (doctor)
  sector?: string; // New: Sector/Floor where the task/message belongs
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  avatar: string;
  color: string;
  status: 'active' | 'inactive' | 'vacation'; // New field
  isAdmin?: boolean; // New: Admin capability
  gender?: 'male' | 'female'; // New: Gender field
  sector?: string; // New: Assigned sector/floor
}

export interface Receptionist {
  id: string;
  name: string;
  sector: string; // Ex: 'Recepção Central', 'Call Center', 'Financeiro'
  phone: string;
  avatar: string;
  status: 'online' | 'offline';
  isAdmin?: boolean; // New: Admin capability
}

export interface RoomAllocation {
  id: string;
  roomId: string;
  roomName: string;
  doctor: Doctor;
  shift: 'Morning' | 'Afternoon' | 'Night';
  date: string;
}

// New DB-oriented types for Daily Map
export interface Room {
  id: string;
  name: string;
  extension?: string;
  sector: string;
  order: number;
}

export interface DBAllocation {
  id: string;
  room_id: string;
  doctor_id: string;
  date: string;
  shift: 'morning' | 'afternoon';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isMe: boolean;
  attachment?: {
    name: string;
    type: 'image' | 'file';
    url: string;
    size?: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
}

export type NoteStatus = 'pending' | 'responded' | 'completed';

export interface NoteHistory {
  id: string;
  actor: 'doctor' | 'reception';
  actorName: string;
  action: 'create' | 'reply' | 'return' | 'complete' | 'read';
  content?: string; // The message/justification
  timestamp: string;
}

export interface Note {
  id: string;
  title: string; // New Field: Title of the note
  type: 'general' | 'patient';
  from: string; // Usually "Recepção"
  to: string; // Doctor ID or User ID

  // Patient Data (Optional)
  patientName?: string;
  patientCard?: string;
  patientPhone?: string;
  appointmentDate?: string;

  content: string; // Original Message

  // Attachment (New)
  attachment?: {
    name: string;
    type: 'image' | 'pdf';
    url: string; // Base64 data URI
  };

  createdAt: string;
  status: NoteStatus;

  history: NoteHistory[]; // Audit trail / Conversation
  category?: 'urgent' | 'process' | 'system' | 'training' | 'general';
  isRead?: boolean;
  authorName?: string;
  audience?: 'all' | 'reception' | 'doctor';
}

export interface ExtractedData {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  procedure: string;
  contact: string;
}

export interface Preparation {
  id: string;
  title: string;
  text: string;
}

export interface DocumentAnalysisResult {
  extractedData: ExtractedData;
  generatedMessage: string;
}

// --- SCRIPTS MODULE TYPES ---
export interface ScriptCategory {
  id: string;
  name: string;
  order: number;
}

export interface Script {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  order: number; // For manual ordering (1, 2, 3...)
}