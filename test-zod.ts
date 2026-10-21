import { z } from 'zod';

export const createStudentSchema = z.object({
  admissionNo: z.string().min(1),
  rollNo: z.string().optional(),
  fullName: z.string().min(2),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  cnicBform: z.string().optional(),
  dob: z.string().date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  address: z.string().optional(),
  mobile: z.string().optional(),
  emergencyContact: z.string().optional(),
  previousSchool: z.string().optional(),
  sectionId: z.string().uuid().optional(),
  admissionDate: z.string().date().optional(),
});

const form = {
  admissionNo: '1234',
  rollNo: '',
  fullName: 'Hamza',
  fatherName: '',
  motherName: '',
  cnicBform: '',
  dob: '',
  gender: 'male',
  bloodGroup: '',
  religion: '',
  address: '',
  mobile: '',
  emergencyContact: '',
  previousSchool: '',
  admissionDate: '',
  sectionId: '',
  status: 'active',
  photoUrl: '',
};

const payload: any = { ...form };
if (!payload.dob) delete payload.dob;
if (!payload.admissionDate) delete payload.admissionDate;
if (!payload.sectionId) delete payload.sectionId;
if (!payload.photoUrl) delete payload.photoUrl;

const res = createStudentSchema.safeParse(payload);
if (!res.success) {
    console.error(JSON.stringify(res.error.flatten().fieldErrors, null, 2));
} else {
    console.log("Success");
}
