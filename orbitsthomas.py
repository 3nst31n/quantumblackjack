import numpy as np
import matplotlib.pyplot as plt


# =========================
# PARAMETERS
# =========================

nodes = 12          # Number of nodes around the circle
radius = 5          # Base circle radius
wave_amplitude = 1  # How far the sine wave moves in/out
wave_cycles = 1     # Number of sine-wave cycles around the circle

show_nodes = True


# =========================
# CREATE THE CURVE
# =========================

# Smooth points used to draw the curve
theta = np.linspace(0, 2 * np.pi, 1000)

# Sine-wave-modulated radius
r = radius + wave_amplitude * np.sin(wave_cycles * theta)

# Convert polar coordinates to Cartesian
x = r * np.cos(theta)
y = r * np.sin(theta)


# =========================
# CREATE NODE POSITIONS
# =========================

node_theta = np.linspace(
    0,
    2 * np.pi,
    nodes,
    endpoint=False
)

node_r = radius + wave_amplitude * np.sin(wave_cycles * node_theta)

node_x = node_r * np.cos(node_theta)
node_y = node_r * np.sin(node_theta)


# =========================
# PLOT
# =========================

fig, ax = plt.subplots(figsize=(8, 8))

# Sine-wave circle
ax.plot(x, y, linewidth=2)

# Nodes
if show_nodes:
    ax.scatter(
        node_x,
        node_y,
        s=60,
        zorder=3
    )

# Connect the nodes
ax.plot(
    np.append(node_x, node_x[0]),
    np.append(node_y, node_y[0]),
    linestyle="--",
    alpha=0.3
)


# =========================
# FORMATTING
# =========================

ax.set_aspect("equal")
ax.grid(True, alpha=0.2)

ax.set_xlabel("X")
ax.set_ylabel("Y")

ax.set_title(
    f"{nodes} Nodes — {wave_cycles} Sine Cycles"
)

plt.show()