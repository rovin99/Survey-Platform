using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuthService.Migrations
{
    /// <inheritdoc />
    public partial class ParticipantsSkill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "conductor_type",
                table: "Conductors",
                newName: "ConductorType");

            migrationBuilder.RenameColumn(
                name: "OfficialEmail",
                table: "Conductors",
                newName: "ContactEmail");

            migrationBuilder.CreateTable(
                name: "ParticipantsSkill",
                columns: table => new
                {
                    ParticipantsSkillId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ParticipantId = table.Column<int>(type: "integer", nullable: false),
                    SkillName = table.Column<string>(type: "text", nullable: false),
                    ProficiencyLevel = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParticipantsSkill", x => x.ParticipantsSkillId);
                    table.ForeignKey(
                        name: "FK_ParticipantsSkill_Participants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "Participants",
                        principalColumn: "ParticipantId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantsSkill_ParticipantId",
                table: "ParticipantsSkill",
                column: "ParticipantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ParticipantsSkill");

            migrationBuilder.RenameColumn(
                name: "ConductorType",
                table: "Conductors",
                newName: "conductor_type");

            migrationBuilder.RenameColumn(
                name: "ContactEmail",
                table: "Conductors",
                newName: "OfficialEmail");
        }
    }
}
