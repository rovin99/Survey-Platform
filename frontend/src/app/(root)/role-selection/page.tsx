"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authService } from "@/services/auth.service";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Skills options for participants
const skillsOptions = [
  { id: "web_dev", label: "Web Development" },
  { id: "mobile_dev", label: "Mobile Development" },
  { id: "ml", label: "Machine Learning" },
  { id: "dl", label: "Deep Learning" },
  { id: "data_science", label: "Data Science" },
  { id: "ui_ux", label: "UI/UX Design" },
  { id: "devops", label: "DevOps" },
  { id: "cloud", label: "Cloud Computing" },
  { id: "cybersecurity", label: "Cybersecurity" },
];

// Conductor registration form schema
const conductorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  conductorType: z.number().int().min(0),
  description: z.string().min(10, "Description must be at least 10 characters"),
  contactEmail: z.string().email("Please enter a valid email address"),
  contactPhone: z.string().min(5, "Phone number must be at least 5 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
});

// Participant registration form schema
const participantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().optional(),
  skills: z.array(
    z.object({
      skillName: z.string(),
      proficiencyLevel: z.number().int().min(1).max(5),
    })
  ).optional(),
});

type ConductorFormValues = z.infer<typeof conductorSchema>;
type ParticipantFormValues = z.infer<typeof participantSchema>;

export default function RoleSelectionPage() {
  const { user, isAuthenticated, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [selectedSkills, setSelectedSkills] = useState<{ id: string; label: string; proficiency: number }[]>([]);
  const [newSkillId, setNewSkillId] = useState<string>("");
  const [newSkillProficiency, setNewSkillProficiency] = useState<string>("3");
  const [registrationStatus, setRegistrationStatus] = useState({
    conductor: false,
    participant: false,
  });

  // Check existing roles
  const isConductor = user?.roles?.includes("Conducting") || false;
  const isParticipant = user?.roles?.includes("Participating") || false;
  const hasBothRoles = isConductor && isParticipant;

  // Auto-fill name from existing user profile
  const userName = user?.username || "";
  const userEmail = user?.email || "";

  // Conductor form - moved to top to avoid conditional hook calls
  const conductorForm = useForm<ConductorFormValues>({
    resolver: zodResolver(conductorSchema),
    defaultValues: {
      name: userName,
      conductorType: 0,
      description: "",
      contactEmail: userEmail,
      contactPhone: "",
      address: "",
    },
  });

  // Participant form - moved to top to avoid conditional hook calls
  const participantForm = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: userName,
      phoneNumber: "",
      skills: [],
    },
  });

  // Update form defaults when user data loads
  useEffect(() => {
    if (userName) {
      if (!conductorForm.getValues("name")) conductorForm.setValue("name", userName);
      if (!participantForm.getValues("name")) participantForm.setValue("name", userName);
    }
    if (userEmail && !conductorForm.getValues("contactEmail")) {
      conductorForm.setValue("contactEmail", userEmail);
    }
  }, [userName, userEmail]);

  // Redirect if not authenticated or if user already has both roles
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
    // Redirect to dashboard if user already has both roles
    if (!loading && isAuthenticated && hasBothRoles) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router, hasBothRoles]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  const handleAddSkill = (skillId: string, proficiency: number) => {
    const skill = skillsOptions.find((s) => s.id === skillId);
    if (skill && !selectedSkills.some((s) => s.id === skillId)) {
      setSelectedSkills([...selectedSkills, { id: skillId, label: skill.label, proficiency }]);
    }
  };

  const handleRemoveSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s.id !== skillId));
  };

  const onSubmitConductor = async (data: ConductorFormValues) => {
    try {
      await authService.registerConductor(data);
      setRegistrationStatus(prev => ({ ...prev, conductor: true }));
      
      // Refresh user data to get updated roles
      await refreshUser();
      
      // Redirect to create survey page for conductors
      setTimeout(() => {
        router.push("/survey/create");
      }, 1500);
    } catch (err: unknown) {
      console.error('Conductor registration error:', err);
      conductorForm.setError("root", {
        message: "Registration failed. Please try again.",
      });
    }
  };



  const onSubmitParticipant = async (data: ParticipantFormValues) => {
    try {
      const skills = selectedSkills.length > 0
        ? selectedSkills.map(skill => ({
            skillName: skill.label,
            proficiencyLevel: skill.proficiency
          }))
        : undefined;

      await authService.registerParticipant({
        name: data.name,
        phoneNumber: data.phoneNumber || undefined,
        skills
      });
      setRegistrationStatus(prev => ({ ...prev, participant: true }));

      // Refresh user data to get updated roles
      await refreshUser();

      // Redirect to dashboard for participants
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      console.error('Participant registration error:', err);
      participantForm.setError("root", {
        message: "Registration failed. Please try again.",
      });
    }
  };

  const redirectToDashboard = () => {
    router.push("/dashboard");
  };

  // Determine default tab (show the one they don't have yet)
  const defaultTab = isConductor ? "participant" : "conductor";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-10">
      <div className="w-full max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-center mb-6">
          {isConductor || isParticipant ? "Add Another Role" : "Complete Your Registration"}
        </h1>
        <p className="text-center mb-8">
          {isConductor || isParticipant
            ? "You can register for additional roles to expand your capabilities"
            : "Choose your role(s) in the system"}
        </p>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="conductor" className="relative">
              Register as Conductor
              {isConductor && <span className="ml-2 text-xs text-green-600">✓</span>}
            </TabsTrigger>
            <TabsTrigger value="participant" className="relative">
              Register as Participant
              {isParticipant && <span className="ml-2 text-xs text-green-600">✓</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conductor">
            <Card>
              <CardHeader>
                <CardTitle>Conductor Registration</CardTitle>
                <CardDescription>
                  Register as a survey conductor to create and manage surveys
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isConductor ? (
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl text-green-600">✓</span>
                    </div>
                    <h3 className="text-lg font-semibold text-green-700 mb-2">Already Registered</h3>
                    <p className="text-gray-600 mb-4">You are already registered as a conductor.</p>
                    <Button onClick={() => router.push("/survey/create")} variant="outline">
                      Go to Create Survey
                    </Button>
                  </div>
                ) : registrationStatus.conductor ? (
                  <div className="p-4 border rounded-md bg-green-50 text-green-600 mb-4">
                    <p className="font-medium">Successfully registered as a conductor!</p>
                    <p className="text-sm mt-2">Redirecting to create survey page...</p>
                  </div>
                ) : (
                  <Form {...conductorForm}>
                    <form onSubmit={conductorForm.handleSubmit(onSubmitConductor)} className="space-y-4">
                      <FormField
                        control={conductorForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter organization name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={conductorForm.control}
                        name="conductorType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conductor Type</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              defaultValue={field.value.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select conductor type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="0">Individual</SelectItem>
                                <SelectItem value="1">Organization</SelectItem>
                                <SelectItem value="2">Academic</SelectItem>
                                <SelectItem value="3">Corporate</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={conductorForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Briefly describe your organization or purpose"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={conductorForm.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="contact@example.com"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={conductorForm.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 (555) 123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={conductorForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter your address"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {conductorForm.formState.errors.root && (
                        <div className="text-red-500 text-sm">
                          {conductorForm.formState.errors.root.message}
                        </div>
                      )}

                      <Button
                        className="w-full"
                        type="submit"
                        disabled={conductorForm.formState.isSubmitting}
                      >
                        {conductorForm.formState.isSubmitting
                          ? "Registering..."
                          : "Register as Conductor"}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participant">
            <Card>
              <CardHeader>
                <CardTitle>Participant Registration</CardTitle>
                <CardDescription>
                  Register as a survey participant to take part in surveys
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isParticipant ? (
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl text-green-600">✓</span>
                    </div>
                    <h3 className="text-lg font-semibold text-green-700 mb-2">Already Registered</h3>
                    <p className="text-gray-600 mb-4">You are already registered as a participant.</p>
                    <Button onClick={() => router.push("/dashboard")} variant="outline">
                      Go to Dashboard
                    </Button>
                  </div>
                ) : registrationStatus.participant ? (
                  <div className="p-4 border rounded-md bg-green-50 text-green-600 mb-4">
                    <p className="font-medium">Successfully registered as a participant!</p>
                    <p className="text-sm mt-2">Redirecting to dashboard...</p>
                  </div>
                ) : (
                  <Form {...participantForm}>
                    <form onSubmit={participantForm.handleSubmit(onSubmitParticipant)} className="space-y-6">
                      {/* Name Field - Required */}
                      <FormField
                        control={participantForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Phone Field - Optional */}
                      <FormField
                        control={participantForm.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number <span className="text-gray-500 font-normal">(optional)</span></FormLabel>
                            <FormControl>
                              <Input placeholder="+1 (555) 123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Skills - Optional */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="font-medium">Add Your Skills <span className="text-gray-500 font-normal">(optional)</span></label>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap gap-2">
                              {selectedSkills.map((skill) => (
                                <div
                                  key={skill.id}
                                  className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full"
                                >
                                  <span>{skill.label} (Level: {skill.proficiency})</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSkill(skill.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-3 gap-4 items-center">
                              <Select value={newSkillId} onValueChange={(value) => setNewSkillId(value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a skill" />
                                </SelectTrigger>
                                <SelectContent>
                                  {skillsOptions
                                    .filter(skill => !selectedSkills.some(s => s.id === skill.id))
                                    .map((skill) => (
                                      <SelectItem key={skill.id} value={skill.id}>
                                        {skill.label}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>

                              <Select value={newSkillProficiency} onValueChange={(v) => setNewSkillProficiency(v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Proficiency level" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 - Beginner</SelectItem>
                                  <SelectItem value="2">2 - Elementary</SelectItem>
                                  <SelectItem value="3">3 - Intermediate</SelectItem>
                                  <SelectItem value="4">4 - Advanced</SelectItem>
                                  <SelectItem value="5">5 - Expert</SelectItem>
                                </SelectContent>
                              </Select>

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  if (!newSkillId) return;
                                  handleAddSkill(newSkillId, parseInt(newSkillProficiency));
                                  setNewSkillId("");
                                  setNewSkillProficiency("3");
                                }}
                                disabled={!newSkillId}
                              >
                                Add Skill
                              </Button>
                            </div>
                          </div>
                          <p className="text-gray-500 text-sm">
                            Skills are optional. You can add them later in your profile.
                          </p>
                        </div>
                      </div>

                      {participantForm.formState.errors.root && (
                        <div className="text-red-500 text-sm">
                          {participantForm.formState.errors.root.message}
                        </div>
                      )}

                      <Button
                        className="w-full"
                        type="submit"
                        disabled={participantForm.formState.isSubmitting}
                      >
                        {participantForm.formState.isSubmitting
                          ? "Registering..."
                          : "Register as Participant"}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {registrationStatus.conductor && registrationStatus.participant && (
          <div className="mt-6 text-center">
            <p className="font-medium text-green-600 mb-4">
              You have successfully registered as both a conductor and participant!
            </p>
            <Button onClick={redirectToDashboard}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 