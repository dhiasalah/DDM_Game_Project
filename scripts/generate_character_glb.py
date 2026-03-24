#!/usr/bin/env python3
"""
Generate simple animated character GLB files.
Creates a capsule-based character with a rigged armature and basic animations.
Usage: blender --background --python generate_character_glb.py -- <output_path>
"""

import bpy
import sys
import math
from mathutils import Vector, Matrix

def clear_scene():
    """Clear all objects from the scene."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

def create_character_mesh(name="Character"):
    """Create a simple character mesh (capsule-like body)."""
    # Create UV Sphere for head
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.25,
        location=(0, 0, 1.5)
    )
    head = bpy.context.active_object
    head.name = f"{name}_Head"
    
    # Create capsule for body (using two cylinders)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.3,
        depth=0.8,
        location=(0, 0, 0.9)
    )
    body = bpy.context.active_object
    body.name = f"{name}_Body"
    
    # Create capsules for arms
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.1,
        depth=0.7,
        location=(0.4, 0, 1.1)
    )
    arm_r = bpy.context.active_object
    arm_r.name = f"{name}_ArmRight"
    
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.1,
        depth=0.7,
        location=(-0.4, 0, 1.1)
    )
    arm_l = bpy.context.active_object
    arm_l.name = f"{name}_ArmLeft"
    
    # Create capsules for legs
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.15,
        depth=0.8,
        location=(0.15, 0, 0.4)
    )
    leg_r = bpy.context.active_object
    leg_r.name = f"{name}_LegRight"
    
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.15,
        depth=0.8,
        location=(-0.15, 0, 0.4)
    )
    leg_l = bpy.context.active_object
    leg_l.name = f"{name}_LegLeft"
    
    # Join all meshes
    context = bpy.context
    context.view_layer.objects.active = head
    for obj in [body, arm_r, arm_l, leg_r, leg_l]:
        obj.select_set(True)
    head.select_set(True)
    
    bpy.ops.object.join()
    mesh = bpy.context.active_object
    mesh.name = f"{name}_Mesh"
    
    return mesh

def create_armature(name="Character"):
    """Create a simple armature for the character."""
    # Create armature
    armature = bpy.data.armatures.new(f"{name}_Armature")
    rig = bpy.data.objects.new(f"{name}_Rig", armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    
    # Enter edit mode to add bones
    bpy.ops.object.mode_set(mode='EDIT')
    bones = armature.edit_bones
    
    # Root bone
    root = bones.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.1)
    
    # Spine
    spine = bones.new("Spine")
    spine.parent = root
    spine.head = (0, 0, 0.1)
    spine.tail = (0, 0, 1.0)
    
    # Head
    head = bones.new("Head")
    head.parent = spine
    head.head = (0, 0, 1.0)
    head.tail = (0, 0, 1.5)
    
    # Arms
    arm_r = bones.new("ArmRight")
    arm_r.parent = spine
    arm_r.head = (0.3, 0, 1.1)
    arm_r.tail = (0.8, 0, 1.1)
    
    arm_l = bones.new("ArmLeft")
    arm_l.parent = spine
    arm_l.head = (-0.3, 0, 1.1)
    arm_l.tail = (-0.8, 0, 1.1)
    
    # Legs
    leg_r = bones.new("LegRight")
    leg_r.parent = root
    leg_r.head = (0.15, 0, 0.1)
    leg_r.tail = (0.15, 0, -0.3)
    
    leg_l = bones.new("LegLeft")
    leg_l.parent = root
    leg_l.head = (-0.15, 0, 0.1)
    leg_l.tail = (-0.15, 0, -0.3)
    
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig

def create_animations(rig):
    """Create simple animations for the character."""
    action_idle = bpy.data.actions.new(name="Idle")
    action_walk = bpy.data.actions.new(name="Walk")
    action_run = bpy.data.actions.new(name="Run")
    
    # Set the armature animation data
    if not rig.animation_data:
        rig.animation_data_create()
    
    rig.animation_data.action = action_idle
    
    # Idle animation (minimal movement) - 30 frames
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = 30
    
    # Create idle keyframes (subtle breathing)
    idle_fcurves = action_idle.fcurves
    fcurve = idle_fcurves.new(data_path='pose.bones["Spine"].location', index=2)
    fcurve.keyframe_points.insert(0).co = (0, 0)
    fcurve.keyframe_points.insert(15).co = (15, 0.05)
    fcurve.keyframe_points.insert(30).co = (30, 0)
    
    # Walk animation - 20 frames per cycle
    walk_fcurves = action_walk.fcurves
    # Leg movement
    for bone_name, offset in [("LegRight", 0), ("LegLeft", 10)]:
        fcurve_x = walk_fcurves.new(data_path=f'pose.bones["{bone_name}"].rotation_euler', index=0)
        for frame in [0, 10, 20]:
            value = 0.3 * math.sin((frame + offset) * math.pi / 10)
            fcurve_x.keyframe_points.insert(frame).co = (frame, value)
    
    # Run animation - 12 frames per cycle (faster)
    run_fcurves = action_run.fcurves
    for bone_name, offset in [("LegRight", 0), ("LegLeft", 6)]:
        fcurve_x = run_fcurves.new(data_path=f'pose.bones["{bone_name}"].rotation_euler', index=0)
        for frame in [0, 6, 12]:
            value = 0.5 * math.sin((frame + offset) * math.pi / 6)
            fcurve_x.keyframe_points.insert(frame).co = (frame, value)
    
    return action_idle, action_walk, action_run

def generate_character_glb(output_path):
    """Generate and export a character as GLB."""
    print(f"Generating animated character GLB: {output_path}")
    
    clear_scene()
    
    # Create character mesh
    mesh = create_character_mesh("Character")
    
    # Create armature
    rig = create_armature("Character")
    
    # Create animations
    actions = create_animations(rig)
    
    # Parent mesh to armature and apply Armature modifier
    mesh.parent = rig
    armature_modifier = mesh.modifiers.new(name="Armature", type='ARMATURE')
    armature_modifier.object = rig
    
    # Select both for export
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    
    # Export as GLB
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_apply=True,
        export_animations=True,
        export_nla_strips=False,
        export_force_sampling=True,
    )
    
    print(f"✓ Generated: {output_path}")

# Main execution
if __name__ == "__main__":
    if len(sys.argv) > 1:
        output_path = sys.argv[-1]
    else:
        output_path = "character.glb"
    
    generate_character_glb(output_path)
