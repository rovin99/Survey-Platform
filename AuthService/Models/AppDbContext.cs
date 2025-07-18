using Microsoft.AspNetCore.Mvc;

using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;


using Microsoft.EntityFrameworkCore;
using AuthService.Models;
 public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }
        public DbSet<Conductor> Conductors { get; set; }
        public DbSet<Participant> Participants { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Configure UserRole composite key
            modelBuilder.Entity<UserRole>()
                .HasKey(ur => new { ur.UserId, ur.RoleId });

            // Configure one-to-many User -> UserRoles
            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(ur => ur.UserId);

            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(ur => ur.RoleId);

            // Configure one-to-one User -> Conductor
            modelBuilder.Entity<Conductor>()
                .HasOne(c => c.User)
                .WithOne(u => u.Conductor)
                .HasForeignKey<Conductor>(c => c.UserId)
                .IsRequired();

            modelBuilder.Entity<Conductor>()
                .Property(c => c.ConductorType)
                .HasConversion<string>(); // Store enum as string

            // Configure one-to-one User -> Participant
            modelBuilder.Entity<Participant>()
                .HasOne(p => p.User)
                .WithOne(u => u.Participant)
                .HasForeignKey<Participant>(p => p.UserId)
                .IsRequired();

            modelBuilder.Entity<Participant>()
                .Property(p => p.ExperienceLevel)
                .HasConversion<string>(); // Store enum as string

            // Configure one-to-many User -> RefreshTokens
            modelBuilder.Entity<RefreshToken>()
                .HasOne(rt => rt.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(rt => rt.UserId)
                .IsRequired();

            // Configure RefreshToken indexes for performance
            modelBuilder.Entity<RefreshToken>()
                .HasIndex(rt => rt.Token)
                .IsUnique();

            modelBuilder.Entity<RefreshToken>()
                .HasIndex(rt => rt.UserId);

            modelBuilder.Entity<RefreshToken>()
                .HasIndex(rt => rt.ExpiresAt);
        }
    }
