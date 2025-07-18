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
  skills: z.array(
    z.object({
      skillName: z.string(),
      proficiencyLevel: z.number().int().min(1).max(5),
    })
  ).min(1, "Select at least one skill"),
});

type ConductorFormValues = z.infer<typeof conductorSchema>;
type ParticipantFormValues = z.infer<typeof participantSchema>;

export default function RoleSelectionPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [selectedSkills, setSelectedSkills] = useState<{ id: string; label: string; proficiency: number }[]>([]);
  const [registrationStatus, setRegistrationStatus] = useState({
    conductor: false,
    participant: false,
  });

  // Conductor form - moved to top to avoid conditional hook calls
  const conductorForm = useForm<ConductorFormValues>({
    resolver: zodResolver(conductorSchema),
    defaultValues: {
      name: "",
      conductorType: 0,
      description: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
    },
  });

  // Participant form - moved to top to avoid conditional hook calls
  const participantForm = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      skills: [],
    },
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

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



  const onSubmitParticipant = async () => {
    try {
      const skills = selectedSkills.map(skill => ({
        skillName: skill.label,
        proficiencyLevel: skill.proficiency
      }));
      
      await authService.registerParticipant({ skills });
      setRegistrationStatus(prev => ({ ...prev, participant: true }));
      
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-10">
      <div className="w-full max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-center mb-6">Complete Your Registration</h1>
        <p className="text-center mb-8">Choose your role(s) in the system</p>

        <Tabs defaultValue="conductor" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="conductor">Register as Conductor</TabsTrigger>
            <TabsTrigger value="participant">Register as Participant</TabsTrigger>
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
                {registrationStatus.conductor ? (
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
                {registrationStatus.participant ? (
                  <div className="p-4 border rounded-md bg-green-50 text-green-600 mb-4">
                    <p className="font-medium">Successfully registered as a participant!</p>
                    <p className="text-sm mt-2">Redirecting to dashboard...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="font-medium">Add Your Skills</label>
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
                          
                          <div className="grid grid-cols-2 gap-4">
                            <Select onValueChange={(value) => {
                              const skillSelect = document.getElementById("proficiency-select") as HTMLSelectElement;
                              if (skillSelect) {
                                handleAddSkill(value, parseInt(skillSelect.value));
                              }
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a skill" />
                              </SelectTrigger>
                              <SelectContent>
                                {skillsOptions.filter(skill => 
                                  !selectedSkills.some(s => s.id === skill.id)
                                ).map((skill) => (
                                  <SelectItem key={skill.id} value={skill.id}>
                                    {skill.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Select defaultValue="3">
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
                          </div>
                        </div>
                      </div>
                    </div>

                    {participantForm.formState.errors.root && (
                      <div className="text-red-500 text-sm">
                        {participantForm.formState.errors.root.message}
                      </div>
                    )}
                    
                    {selectedSkills.length === 0 && (
                      <div className="text-amber-500 text-sm">
                        Please add at least one skill to continue
                      </div>
                    )}

                    <Button
                      className="w-full"
                      type="button"
                      disabled={selectedSkills.length === 0 || participantForm.formState.isSubmitting}
                      onClick={onSubmitParticipant}
                    >
                      {participantForm.formState.isSubmitting
                        ? "Registering..."
                        : "Register as Participant"}
                    </Button>
                  </div>
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