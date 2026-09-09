/**
 * Live Firestore hooks for the admin module. Each hook subscribes via
 * onSnapshot and exposes a simple { data, loading } shape so pages don't
 * need to manage subscription lifecycles themselves.
 */
import { useEffect, useState } from "react";
import { onSnapshot, query, where, doc, type Unsubscribe } from "firebase/firestore";
import {
  departmentsCol,
  classesCol,
  divisionsCol,
  subjectsCol,
  studentsCol,
  teachersCol,
  policyCol,
  sessionsCol,
} from "@/firebase/firestore";
import type { Department, ClassRecord, Division, Subject, StudentRecord, AttendancePolicy } from "@/types";
import type { TeacherRecordExt } from "../services/adminDataService";

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      departmentsCol,
      (snap) => {
        setDepartments(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { departments, loading };
}

export function useClasses() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      classesCol,
      (snap) => {
        setClasses(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { classes, loading };
}

export function useDivisions(classId?: string) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = classId ? query(divisionsCol, where("classId", "==", classId)) : divisionsCol;
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setDivisions(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [classId]);

  return { divisions, loading };
}

export function useSubjects(classId?: string) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = classId ? query(subjectsCol, where("classId", "==", classId)) : subjectsCol;
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setSubjects(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [classId]);

  return { subjects, loading };
}

export interface StudentFilters {
  classId?: string;
  divisionId?: string;
}

export function useStudents(filters?: StudentFilters) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const classId = filters?.classId;
  const divisionId = filters?.divisionId;

  useEffect(() => {
    setLoading(true);
    const constraints = [];
    if (classId) constraints.push(where("classId", "==", classId));
    if (divisionId) constraints.push(where("divisionId", "==", divisionId));
    const q = constraints.length ? query(studentsCol, ...constraints) : studentsCol;
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setStudents(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [classId, divisionId]);

  return { students, loading };
}

export function useTeachers() {
  const [teachers, setTeachers] = useState<TeacherRecordExt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      teachersCol,
      (snap) => {
        setTeachers(snap.docs.map((d) => d.data() as TeacherRecordExt));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { teachers, loading };
}

export function useAttendancePolicy() {
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(policyCol, "attendancePolicy");
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setPolicy(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { policy, loading };
}

/** Count of attendance sessions currently open (status === "open"), live. */
export function useActiveSessionsToday() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(sessionsCol, where("status", "==", "open"));
    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setCount(snap.size);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { count, loading };
}
