import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import {
  CharacterNote,
  CharacterNoteDocument,
} from './schemas/character-note.schema';
import { Character, CharacterDocument } from './schemas/character.schema';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

/** A note loaded via `.lean()` — plain object with an ObjectId `_id`. */
type LeanNote = CharacterNote & { _id: Types.ObjectId };

/** Public shape: never leaks `_id`/`__v`, stringifies ids. */
function toNoteResponse(n: LeanNote) {
  return {
    id: n.id,
    title: n.title,
    note: n.note ?? '',
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

@Injectable()
export class CharacterNotesService {
  constructor(
    @InjectModel(CharacterNote.name)
    private noteModel: Model<CharacterNoteDocument>,
    @InjectModel(Character.name)
    private characterModel: Model<CharacterDocument>,
  ) {}

  /** All notes for a character, oldest-first. Access is enforced by the guard. */
  async list(characterId: string) {
    const notes = await this.noteModel
      .find({ characterId: new Types.ObjectId(characterId) })
      .sort({ createdAt: 1 })
      .lean<LeanNote[]>();
    return notes.map(toNoteResponse);
  }

  /**
   * Create a note under a character. `id` is server-minted; `characterId`,
   * `campaignId`, and `userId` are copied from the (guard-validated) parent
   * character so the note inherits its scoping and ownership.
   */
  async create(campaignId: string, characterId: string, dto: CreateNoteDto) {
    const character = await this.characterModel
      .findById(characterId)
      .lean<{ campaignId: Types.ObjectId; userId: Types.ObjectId }>();
    // The guard already proved existence/access; guard against a race only.
    if (!character) throw new NotFoundException();

    const created = await this.noteModel.create({
      id: nanoid(8),
      characterId: new Types.ObjectId(characterId),
      campaignId: character.campaignId,
      userId: character.userId,
      title: dto.title,
      note: dto.note ?? '',
    });
    return toNoteResponse(created.toObject() as LeanNote);
  }

  /** Merge `title`/`note` on a note owned by this character; 404 otherwise. */
  async update(characterId: string, noteId: string, dto: UpdateNoteDto) {
    const set: Record<string, unknown> = {};
    if (dto.title !== undefined) set.title = dto.title;
    if (dto.note !== undefined) set.note = dto.note;

    const updated = await this.noteModel
      .findOneAndUpdate(
        { id: noteId, characterId: new Types.ObjectId(characterId) },
        { $set: set },
        { new: true },
      )
      .lean<LeanNote>();
    if (!updated) throw new NotFoundException();
    return toNoteResponse(updated);
  }

  /** Remove a note owned by this character; 404 if it does not exist here. */
  async remove(characterId: string, noteId: string) {
    const deleted = await this.noteModel.findOneAndDelete({
      id: noteId,
      characterId: new Types.ObjectId(characterId),
    });
    if (!deleted) throw new NotFoundException();
  }
}
