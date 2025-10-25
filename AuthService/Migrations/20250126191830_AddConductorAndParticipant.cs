using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuthService.Migrations
{
    /// <inheritdoc />
    public partial class AddConductorAndParticipant : Migration
    {
        /// <inheritdoc />
        // protected override void Up(MigrationBuilder migrationBuilder)
        // {
        //     migrationBuilder.AlterColumn<string>(
        //         name: "Username",
        //         table: "Users",
        //         type: "character varying(20)",
        //         maxLength: 20,
        //         nullable: false,
        //         oldClrType: typeof(string),
        //         oldType: "text");

        //     migrationBuilder.CreateTable(
        //         name: "Conductors",
        //         columns: table => new
        //         {
        //             ConductorId = table.Column<int>(type: "integer", nullable: false)
        //                 .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
        //             UserId = table.Column<int>(type: "integer", nullable: false),
        //             Name = table.Column<string>(type: "text", nullable: false),
        //             ConductorType = table.Column<string>(type: "text", nullable: false),
        //             Description = table.Column<string>(type: "text", nullable: false),
        //             ContactEmail = table.Column<string>(type: "text", nullable: false),
        //             ContactPhone = table.Column<string>(type: "text", nullable: false),
        //             Address = table.Column<string>(type: "text", nullable: false),
        //             IsVerified = table.Column<bool>(type: "boolean", nullable: false),
        //             CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
        //             UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
        //         },
        //         constraints: table =>
        //         {
        //             table.PrimaryKey("PK_Conductors", x => x.ConductorId);
        //             table.ForeignKey(
        //                 name: "FK_Conductors_Users_UserId",
        //                 column: x => x.UserId,
        //                 principalTable: "Users",
        //                 principalColumn: "UserId",
        //                 onDelete: ReferentialAction.Cascade);
        //         });

        //     migrationBuilder.CreateTable(
        //         name: "Participants",
        //         columns: table => new
        //         {
        //             ParticipantId = table.Column<int>(type: "integer", nullable: false)
        //                 .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
        //             UserId = table.Column<int>(type: "integer", nullable: false),
        //             ExperienceLevel = table.Column<string>(type: "text", nullable: false),
        //             Rating = table.Column<decimal>(type: "numeric", nullable: false),
        //             IsActive = table.Column<bool>(type: "boolean", nullable: false),
        //             CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
        //             UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
        //         },
        //         constraints: table =>
        //         {
        //             table.PrimaryKey("PK_Participants", x => x.ParticipantId);
        //             table.ForeignKey(
        //                 name: "FK_Participants_Users_UserId",
        //                 column: x => x.UserId,
        //                 principalTable: "Users",
        //                 principalColumn: "UserId",
        //                 onDelete: ReferentialAction.Cascade);
        //         });

        //     migrationBuilder.CreateIndex(
        //         name: "IX_Conductors_UserId",
        //         table: "Conductors",
        //         column: "UserId",
        //         unique: true);

        //     migrationBuilder.CreateIndex(
        //         name: "IX_Participants_UserId",
        //         table: "Participants",
        //         column: "UserId",
        //         unique: true);
        // }

        // /// <inheritdoc />
        // protected override void Down(MigrationBuilder migrationBuilder)
        // {
        //     migrationBuilder.DropTable(
        //         name: "Conductors");

        //     migrationBuilder.DropTable(
        //         name: "Participants");

        //     migrationBuilder.AlterColumn<string>(
        //         name: "Username",
        //         table: "Users",
        //         type: "text",
        //         nullable: false,
        //         oldClrType: typeof(string),
        //         oldType: "character varying(20)",
        //         oldMaxLength: 20);
        // }

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Conductors",
                columns: table => new
                {
                    ConductorId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ConductorType = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    ContactEmail = table.Column<string>(type: "text", nullable: true),
                    ContactPhone = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    IsVerified = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Conductors", x => x.ConductorId);
                    table.ForeignKey(
                        name: "FK_Conductors_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Participants",
                columns: table => new
                {
                    ParticipantId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ExperienceLevel = table.Column<string>(type: "text", nullable: false),
                    Rating = table.Column<decimal>(type: "numeric", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Participants", x => x.ParticipantId);
                    table.ForeignKey(
                        name: "FK_Participants_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Conductors_UserId",
                table: "Conductors",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Participants_UserId",
                table: "Participants",
                column: "UserId",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Conductors");

            migrationBuilder.DropTable(
                name: "Participants");
        }
    }
}
