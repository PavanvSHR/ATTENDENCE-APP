import {
  collection,
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./config";
import type {
  UserRecord,
  StudentRecord,
  TeacherRecord,
  Department,
  ClassRecord,
  Division,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  AuditLogEntry,
  AppNotification,
  RegisteredDevice,
  AttendancePolicy,
} from "@/types";

/** Typed converter so Firestore reads/writes are checked against our domain types. */
function converter<T extends DocumentData>() {
  return {
    toFirestore: (data: T) => data,
    fromFirestore: (snap: QueryDocumentSnapshot) => snap.data() as T,
  };
}

function typedCollection<T extends DocumentData>(path: string): CollectionReference<T> {
  return collection(db, path).withConverter(converter<T>());
}

// Firestore collection references — the canonical schema (see docs/ARCHITECTURE.md).
export const usersCol = typedCollection<UserRecord>("users");
export const studentsCol = typedCollection<StudentRecord>("students");
export const teachersCol = typedCollection<TeacherRecord>("teachers");
export const departmentsCol = typedCollection<Department>("departments");
export const classesCol = typedCollection<ClassRecord>("classes");
export const divisionsCol = typedCollection<Division>("divisions");
export const subjectsCol = typedCollection<Subject>("subjects");
export const sessionsCol = typedCollection<AttendanceSession>("attendanceSessions");
export const recordsCol = typedCollection<AttendanceRecord>("attendanceRecords");
export const auditLogsCol = typedCollection<AuditLogEntry>("auditLogs");
export const notificationsCol = typedCollection<AppNotification>("notifications");
export const devicesCol = typedCollection<RegisteredDevice>("devices");
export const policyCol = typedCollection<AttendancePolicy>("settings");
